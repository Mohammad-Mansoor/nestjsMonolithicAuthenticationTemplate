import { SelectQueryBuilder, Brackets, Repository, ObjectLiteral } from 'typeorm';
import { QueryOptionsDto, SortOrder } from '../dto/query-options.dto';
import { BadRequestException } from '@nestjs/common';

export class TypeOrmQueryHelper<T extends ObjectLiteral> {
  private joinedEntities = new Set<string>();

  constructor(
    private readonly repository: Repository<T>,
    private readonly queryOptions: QueryOptionsDto,
    private readonly alias: string = 'root',
  ) {}

  public static for<T extends ObjectLiteral>(
    repository: Repository<T>,
    options: QueryOptionsDto,
    alias?: string,
  ) {
    return new TypeOrmQueryHelper<T>(repository, options, alias);
  }

  public build(): SelectQueryBuilder<T> {
    const qb = this.repository.createQueryBuilder(this.alias);

    this.applyFields(qb);
    this.applyIncludes(qb);
    this.applyFilters(qb);
    this.applySearch(qb);
    this.applySorting(qb);
    this.applyPagination(qb);

    return qb;
  }

  public async getManyAndMeta() {
    const [data, total] = await this.build().getManyAndCount();
    const limit = this.queryOptions.limit || 10;
    const page = this.queryOptions.page || 1;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  private applyFields(qb: SelectQueryBuilder<T>) {
    if (this.queryOptions.fields && this.queryOptions.fields.length > 0) {
      const selection = this.queryOptions.fields.map((f) => {
        if (f.includes('.')) {
          const parts = f.split('.');
          const field = parts.pop();
          const relationAlias = parts.join('_');
          this.ensureJoin(qb, parts.join('.'));
          return `${relationAlias}.${field}`;
        }
        return `${this.alias}.${f}`;
      });
      qb.select(selection);
    }
  }

  private applyIncludes(qb: SelectQueryBuilder<T>) {
    if (this.queryOptions.includes) {
      this.queryOptions.includes.forEach((include) => {
        this.ensureJoin(qb, include, true);
      });
    }
  }

  private applyFilters(qb: SelectQueryBuilder<T>) {
    if (!this.queryOptions.filters) return;

    Object.entries(this.queryOptions.filters).forEach(([key, value]) => {
      const fullPath = this.resolvePath(qb, key);
      const paramName = `filter_${key.replace(/\./g, '_')}`;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Handle Operators: { price: { $gt: 100 } }
        Object.entries(value).forEach(([operator, val]) => {
          this.addFilterOperator(qb, fullPath, operator, val, paramName);
        });
      } else {
        // Direct match: { name: 'John' }
        qb.andWhere(`${fullPath} = :${paramName}`, { [paramName]: value });
      }
    });
  }

  private addFilterOperator(
    qb: SelectQueryBuilder<T>,
    path: string,
    op: string,
    val: any,
    param: string,
  ) {
    switch (op) {
      case '$eq':
        qb.andWhere(`${path} = :${param}`, { [param]: val });
        break;
      case '$ne':
        qb.andWhere(`${path} != :${param}`, { [param]: val });
        break;
      case '$gt':
        qb.andWhere(`${path} > :${param}`, { [param]: val });
        break;
      case '$gte':
        qb.andWhere(`${path} >= :${param}`, { [param]: val });
        break;
      case '$lt':
        qb.andWhere(`${path} < :${param}`, { [param]: val });
        break;
      case '$lte':
        qb.andWhere(`${path} <= :${param}`, { [param]: val });
        break;
      case '$in':
        qb.andWhere(`${path} IN (:...${param})`, { [param]: val });
        break;
      case '$like':
        qb.andWhere(`${path} LIKE :${param}`, { [param]: `%${val}%` });
        break;
      case '$ilike':
        qb.andWhere(`${path} ILIKE :${param}`, { [param]: `%${val}%` });
        break;
      case '$null':
        val ? qb.andWhere(`${path} IS NULL`) : qb.andWhere(`${path} IS NOT NULL`);
        break;
    }
  }

  private applySearch(qb: SelectQueryBuilder<T>) {
    const { search, searchFields } = this.queryOptions;
    if (!search || !searchFields || searchFields.length === 0) return;

    qb.andWhere(
      new Brackets((innerQb) => {
        searchFields.forEach((field, index) => {
          const path = this.resolvePath(qb, field);
          const condition = `${path} ILIKE :search`;
          if (index === 0) {
            innerQb.where(condition);
          } else {
            innerQb.orWhere(condition);
          }
        });
      }),
      { search: `%${search}%` },
    );
  }

  private applySorting(qb: SelectQueryBuilder<T>) {
    if (!this.queryOptions.sort) {
      qb.addOrderBy(`${this.alias}.createdAt`, SortOrder.DESC);
      return;
    }

    const sortFields = this.queryOptions.sort.split(',');
    sortFields.forEach((sortStr) => {
      const [field, order] = sortStr.split(':');
      const path = this.resolvePath(qb, field);
      qb.addOrderBy(path, (order?.toUpperCase() as SortOrder) || SortOrder.ASC);
    });
  }

  private applyPagination(qb: SelectQueryBuilder<T>) {
    if (this.queryOptions.cursor) {
      // Basic Cursor Pagination Logic (simplified)
      // In a real app, decode cursor and use index-friendly WHERE instead of OFFSET
      const decoded = Buffer.from(this.queryOptions.cursor, 'base64').toString();
      qb.andWhere(`${this.alias}.id > :cursor`, { cursor: decoded });
    } else {
      const limit = this.queryOptions.limit || 10;
      const page = this.queryOptions.page || 1;
      qb.take(limit);
      qb.skip((page - 1) * limit);
    }
  }

  private resolvePath(qb: SelectQueryBuilder<T>, path: string): string {
    if (!path.includes('.')) return `${this.alias}.${path}`;

    const parts = path.split('.');
    const field = parts.pop();
    const relationPath = parts.join('.');
    const relationAlias = parts.join('_');

    this.ensureJoin(qb, relationPath);

    return `${relationAlias}.${field}`;
  }

  private ensureJoin(qb: SelectQueryBuilder<T>, fullPath: string, eager: boolean = false) {
    const parts = fullPath.split('.');
    let currentPath = '';

    parts.forEach((part, index) => {
      const parentAlias = index === 0 ? this.alias : parts.slice(0, index).join('_');
      const relationAlias = parts.slice(0, index + 1).join('_');
      const relationPath = `${parentAlias}.${part}`;

      if (!this.joinedEntities.has(relationAlias)) {
        if (eager) {
          qb.leftJoinAndSelect(relationPath, relationAlias);
        } else {
          qb.leftJoin(relationPath, relationAlias);
        }
        this.joinedEntities.add(relationAlias);
      }
    });
  }
}
