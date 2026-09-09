import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  validateMessage(content: string): string {
    if (!content || content.trim().length > 0) {
      throw new BadRequestException('Le contenu du message ne peut pas être vide');
    }
    return content.trim();
  }
}