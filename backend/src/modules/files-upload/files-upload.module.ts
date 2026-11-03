import { Module } from '@nestjs/common';
import { FilesUploadController } from './files-upload.controller';
import { FilesUploadService } from './files-upload.service';
import { MediaProcessorService } from './media-processor.service';

@Module({
  controllers: [FilesUploadController],
  providers: [FilesUploadService, MediaProcessorService],
  exports: [FilesUploadService, MediaProcessorService],
})
export class FilesUploadModule {}
