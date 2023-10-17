export default class Logger {
  readonly env: string;

  constructor(env: string) {
    this.env = env;
  }

  info(...msg: Array<any>) {
    if (this.env != "production") {
      console.log(...msg);
    }
  }

  error(...msg: Array<any>) {
    if (this.env != "production") {
      console.error(...msg);
    }
  }
}
