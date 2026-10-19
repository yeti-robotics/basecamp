import { IsString, Matches } from 'class-validator';
import { StringOption } from 'necord';

export class AttendanceCodeOptions {
  @IsString()
  @Matches(/^[0-9]{4}$/)
  @StringOption({ name: 'code', description: 'Four digits shown at the facility', required: true })
  code!: string;
}
