import { IsOptional, IsInt, Min, IsString, IsArray, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class QueryOptionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  sort?: string; // Format: "field1:ASC,field2:DESC"

  @IsOptional()
  @IsString()
  search?: string;

  [key: string]: any; // Allow flat filter parameters (e.g. ?status=active, ?price_gt=100)
}
