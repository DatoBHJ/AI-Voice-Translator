export interface Language {
  code: string;  // ISO 639-1 language code
  name: string;  // Full language name in English
}

export interface LanguagePair {
  sourceLanguage: Language;
  targetLanguage: Language;
}

// Custom errors for language detection
export class UnrecognizedLanguageError extends Error {
  constructor(message = 'Language could not be recognized') {
    super(message);
    this.name = 'UnrecognizedLanguageError';
  }
}

export class InvalidInputFormatError extends Error {
  constructor(message = 'Invalid input format') {
    super(message);
    this.name = 'InvalidInputFormatError';
  }
}

export class MissingLanguagePairError extends Error {
  constructor(message = 'Source or target language is missing') {
    super(message);
    this.name = 'MissingLanguagePairError';
  }
} 