import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController & AppService', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('Règle métier du chat : validation de message', () => {
    it('devrait accepter un message valide', () => {
      const text = 'Bonjour tout le monde !';
      expect(appService.validateMessage(text)).toBe(text);
    });

    it('devrait lever une BadRequestException si le message est vide ou rempli d\'espaces', () => {
      expect(() => appService.validateMessage('')).toThrow(BadRequestException);
      expect(() => appService.validateMessage('   ')).toThrow(BadRequestException);
    });
  });
});