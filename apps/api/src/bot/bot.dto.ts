import { IsBoolean, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class SetBotTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token!: string;
}

export class SetBotEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}

export class SetBotStatusMessageDto {
  @IsString()
  @Matches(/\S/, { message: 'Status message is required' })
  @MaxLength(128)
  statusMessage!: string;
}
