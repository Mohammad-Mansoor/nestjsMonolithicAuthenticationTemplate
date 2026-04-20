import { Options } from 'amqplib';

export interface RabbitMQExchangeConfig {
  name: string;
  type: string;
  options?: Options.AssertExchange;
}

export interface RabbitMQModuleOptions {
  urls: string[];
  exchanges?: RabbitMQExchangeConfig[];
}
