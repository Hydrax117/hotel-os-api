import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('App - Health Check (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /search/popular-cities - should return 200 (API is healthy)', () => {
    return request(app.getHttpServer())
      .get('/search/popular-cities')
      .expect(200);
  });

  it('GET /search/hotels - should return 200 (public endpoint accessible)', () => {
    return request(app.getHttpServer())
      .get('/search/hotels')
      .expect(200);
  });
});
