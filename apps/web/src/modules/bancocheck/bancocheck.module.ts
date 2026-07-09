import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BancocheckService } from './bancocheck.service';
import { BancocheckRepository } from './bancocheck.repository';
import { BancocheckController } from './bancocheck.controller';

@Module({
  controllers: [BancocheckController],
  providers: [BancocheckService, BancocheckRepository, PrismaService],
  exports: [BancocheckService],
})
export class BancocheckModule {}
