export const SLACK_LIMITS = {
  messageBlocks: 50,
  topLevelTextRecommended: 4_000,
  topLevelTextHard: 40_000,
  headerText: 150,
  sectionText: 3_000,
  sectionFields: 10,
  fieldText: 2_000,
  contextElements: 10,
  actionElements: 25,
  buttonText: 75,
  buttonValue: 2_000,
  buttonUrl: 3_000,
  blockId: 255,
  imageAltText: 2_000,
  imageUrl: 3_000,
  imageTitle: 2_000
} as const;
