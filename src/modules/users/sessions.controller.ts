import { Controller, Get, Param, Query } from "@nestjs/common";
import { SessionsService } from "./sessions.service";


@Controller('sessions')
export class SessionsController{
    constructor(
        private readonly sessionsService:SessionsService
    ){}

    @Get('user/:userId')
    async getUserSessions(@Param('userId') userId: string, @Query() query:any){

        return this.sessionsService.findUserSessions(userId, query)
    }
}