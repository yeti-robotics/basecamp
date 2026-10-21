import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

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
