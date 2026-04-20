import { DynamicModule, Module, Provider } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { RabbitMQModuleOptions } from './rabbitmq.interfaces';
import { RABBITMQ_OPTIONS } from './rabbitmq.constants';

export interface RabbitMQModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => Promise<RabbitMQModuleOptions> | RabbitMQModuleOptions;
}

@Module({})
export class RabbitMQModule {
  static register(options: RabbitMQModuleOptions): DynamicModule {
    return {
      module: RabbitMQModule,
      providers: [
        {
          provide: RABBITMQ_OPTIONS,
          useValue: options,
        },
        RabbitMQService,
      ],
      exports: [RabbitMQService],
    };
  }

  static registerAsync(options: RabbitMQModuleAsyncOptions): DynamicModule {
    const asyncOptionsProvider: Provider = {
      provide: RABBITMQ_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };

    return {
      module: RabbitMQModule,
      imports: options.imports || [],
      providers: [asyncOptionsProvider, RabbitMQService],
      exports: [RabbitMQService],
    };
  }
}
