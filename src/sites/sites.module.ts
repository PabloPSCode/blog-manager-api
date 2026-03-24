import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';

@Module({
  imports: [FirebaseModule],
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
