import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ExcelController } from './excel.controller';
import { ExcelService } from './excel.service';

@Module({
    imports: [
        MulterModule.register({
            limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
        }),
    ],
    controllers: [ExcelController],
    providers: [ExcelService],
    exports: [ExcelService],
})
export class ExcelModule { }
