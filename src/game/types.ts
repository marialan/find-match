export type Side = "left" | "right";
export type ObjectType = "letter" | "audio";

export interface LanguagePack {
  code: string;
  speechLocale: string;
}

export interface TrialObject {
  object_id: string;
  pos: [number, number];
  target: string;
  type: ObjectType;
  pair_id: string[];
  image?: string;
  audio?: string;
  repetitions?: number;
}

export interface Trial {
  trial_num: number;
  left: TrialObject[];
  right: TrialObject[];
  repetitions?: number;
}

export interface BoardObject extends TrialObject {
  side: Side;
  x: number;
  y: number;
  solved: boolean;
  mergedInto?: string;
}
