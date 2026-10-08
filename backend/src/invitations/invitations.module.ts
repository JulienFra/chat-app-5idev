import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { TeamsModule } from '../teams/teams.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [RealtimeModule, TeamsModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}