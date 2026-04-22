import { SelectQueryBuilder, Brackets, Repository, ObjectLiteral } from 'typeorm';
import { QueryOptionsDto, SortOrder } from '../dto/query-options.dto';
import { BadRequestException } from '@nestjs/common';

export interface QueryConfig {
  searchableFields?: string[];
  filterableFields?: Record<string, string>;
  relations?: string[];
  selectFields?: string[];
  defaultSort?: string; // e.g., 'createdAt:DESC,firstName:ASC'
  translatedFields?: string[]; // Arrays of jsonb columns (e.g. ['name', 'profile.bio'])
}

export class TypeOrmQueryHelper<T extends ObjectLiteral> {
  private joinedEntities = new Set<string>();

  constructor(
    private readonly repository: Repository<T>,
    private readonly queryOptions: QueryOptionsDto,
    private readonly config: QueryConfig = {},
    private readonly alias: string = 'root',
  ) {}

  public static for<T extends ObjectLiteral>(
    repository: Repository<T>,
    options: QueryOptionsDto,
    config: QueryConfig = {},
    alias?: string,
  ) {
    return new TypeOrmQueryHelper<T>(repository, options, config, alias);
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
    const limit = Number(this.queryOptions.limit) || 10;
    const page = Number(this.queryOptions.page) || 1;

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
    if (this.config.selectFields && this.config.selectFields.length > 0) {
      qb.select([]); // Clear initial wrapper
      const lang = this.queryOptions.lang || 'en';

      this.config.selectFields.forEach((f) => {
        let fieldPath = `${this.alias}.${f}`;
        let relationAlias = this.alias;
        let fieldName = f;

        if (f.includes('.')) {
          const parts = f.split('.');
          fieldName = parts.pop()!;
          const relationPath = parts.join('.');
          relationAlias = parts.join('_');
          this.ensureJoin(qb, relationPath, false);
          fieldPath = `${relationAlias}.${fieldName}`;
        }

        // Native extraction for Language mapped fields
        if (this.config.translatedFields && this.config.translatedFields.includes(f)) {
          qb.addSelect(`${fieldPath} ->> :lang`, `${relationAlias}_${fieldName}`);
          qb.setParameter('lang', lang);
        } else {
          qb.addSelect(fieldPath, `${relationAlias}_${fieldName}`);
        }
      });
      
      // TypeORM requires the primary key of the root entity when using skip/take with joins
      const isIdSelected = qb.expressionMap.selects.some(s => s.selection === `${this.alias}.id`);
      if (!isIdSelected) {
        qb.addSelect(`${this.alias}.id`, `${this.alias}_id`);
      }
    }
  }

  private applyIncludes(qb: SelectQueryBuilder<T>) {
    const hasExplicitFields = this.config.selectFields && this.config.selectFields.length > 0;
    
    if (this.config.relations) {
      this.config.relations.forEach((include) => {
        this.ensureJoin(qb, include, !hasExplicitFields);
      });
    }
  }

  private applyFilters(qb: SelectQueryBuilder<T>) {
    if (!this.config.filterableFields) return;

    const predefinedKeys = ['page', 'limit', 'search', 'cursor', 'sort'];

    Object.entries(this.queryOptions).forEach(([key, value]) => {
      if (predefinedKeys.includes(key)) return;
      if (value === undefined || value === null || value === '') return;

      const match = key.match(/^(.+?)(_(eq|ne|gt|gte|lt|lte|in|like|ilike|null))?$/);
      if (!match) return;

      const baseKey = match[1];
      const op = match[3] || 'eq';

      const path = this.config.filterableFields![baseKey];
      if (!path) return;

      const fullPath = this.resolvePath(qb, path);
      let conditionPath = fullPath;
      
      if (this.config.translatedFields && this.config.translatedFields.includes(path)) {
         const lang = this.queryOptions.lang || 'en';
         conditionPath = `${fullPath} ->> :lang`;
         qb.setParameter('lang', lang);
      }

      // Generate a unique param name to avoid clashes if multiple filters happen
      const paramName = `filter_${baseKey}_${op}_${Math.random().toString(36).substring(7)}`;

      let parsedValue = value;
      if (op === 'in') {
        parsedValue = Array.isArray(value) ? value : String(value).split(',');
      } else if (op === 'null') {
        parsedValue = value === 'true' || value === true || value === '1';
      } else if (Array.isArray(value)) {
        // Fallback for arrays not used with 'in', just take the first element (or you could throw an error)
        parsedValue = value[0];
      }

      this.addFilterOperator(qb, conditionPath, `$${op}`, parsedValue, paramName);
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
    const { search } = this.queryOptions;
    const searchFields = this.config.searchableFields;
    
    if (!search || !searchFields || searchFields.length === 0) return;

    qb.andWhere(
      new Brackets((innerQb) => {
        const lang = this.queryOptions.lang || 'en';

        searchFields.forEach((field, index) => {
          const path = this.resolvePath(qb, field);
          let conditionPath = path;

          if (this.config.translatedFields && this.config.translatedFields.includes(field)) {
             conditionPath = `${path} ->> :lang`;
             qb.setParameter('lang', lang);
          }

          const condition = `${conditionPath} ILIKE :search`;
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
    const hasExplicitFields = this.config.selectFields && this.config.selectFields.length > 0;
    const sortParams = this.queryOptions.sort || this.config.defaultSort;

    if (!sortParams) {
      qb.addOrderBy(`${this.alias}.createdAt`, SortOrder.DESC);
      const isSelected = qb.expressionMap.selects.some(s => s.selection === `${this.alias}.createdAt`);
      if (hasExplicitFields && !isSelected) {
        qb.addSelect(`${this.alias}.createdAt`);
      }
      return;
    }

    const sortFields = sortParams.split(',');
    sortFields.forEach((sortStr) => {
      let [field, order] = sortStr.split(':');
      
      // Allow the frontend to sort using the same abstract mapped keys!
      if (this.config.filterableFields && this.config.filterableFields[field]) {
        field = this.config.filterableFields[field];
      }

      const path = this.resolvePath(qb, field);
      let orderPath = path;

      if (this.config.translatedFields && this.config.translatedFields.includes(field)) {
         const lang = this.queryOptions.lang || 'en';
         orderPath = `${path} ->> :lang`;
         qb.setParameter('lang', lang);
      }

      qb.addOrderBy(orderPath, (order?.toUpperCase() as SortOrder) || SortOrder.ASC);
      
      const isSelected = qb.expressionMap.selects.some(s => s.selection === path);
      if (hasExplicitFields && !isSelected) {
        qb.addSelect(path);
      }
    });
  }

  private applyPagination(qb: SelectQueryBuilder<T>) {
    if (this.queryOptions.cursor) {
      // Basic Cursor Pagination Logic (simplified)
      // In a real app, decode cursor and use index-friendly WHERE instead of OFFSET
      const decoded = Buffer.from(this.queryOptions.cursor, 'base64').toString();
      qb.andWhere(`${this.alias}.id > :cursor`, { cursor: decoded });
    } else {
      const limit = Number(this.queryOptions.limit) || 10;
      const page = Number(this.queryOptions.page) || 1;
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
