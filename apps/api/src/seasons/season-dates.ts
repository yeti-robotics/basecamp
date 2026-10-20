export interface SeasonDateRange {
  startsOn: string;
  endsOn: string;
}

export function defaultSeasonDates(startYear: number): SeasonDateRange {
  return {
    startsOn: `${String(startYear).padStart(4, '0')}-05-15`,
    endsOn: `${String(startYear + 1).padStart(4, '0')}-05-14`,
  };
}

export function isCurrentSeason(season: SeasonDateRange, localDate: string): boolean {
  return season.startsOn <= localDate && localDate <= season.endsOn;
}

export function overlaps(a: SeasonDateRange, b: SeasonDateRange): boolean {
  return a.startsOn <= b.endsOn && b.startsOn <= a.endsOn;
}
