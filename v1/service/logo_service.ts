export class LogoService {
  readonly hostname: string;

  constructor(hostname: string) {
    this.hostname = hostname;
  }

  private async logoFromSrc(src: string): Promise<Uint8Array> {
    const response = await fetch(src);

    const buf = await response.arrayBuffer();
    const u = new Uint8Array(buf);

    return u;
  }

  async logoFromDomain(domain: string, format: string): Promise<Uint8Array> {
    try {
      const endpointURL = new URL("/v2/brands", this.hostname);

      const response = await fetch(`${endpointURL}/${domain}`);

      const j = await response.json();

      if (j.logos) {
        let logos = j.logos.filter(function (v: any) {
          return v.type == "icon" && v.theme == "dark";
        });

        if (logos.length == 0) {
          logos = j.logos.filter(function (v: any) {
            return v.type == "icon";
          });
        }

        if (logos.length == 0) {
          logos = j.logos.filter(function (v: any) {
            return v.type == "symbol" && v.theme == "dark";
          });
        }

        if (logos.length == 0) {
          logos = j.logos.filter(function (v: any) {
            return v.type == "symbol";
          });
        }

        if (logos.length == 0) {
          logos = j.logos.filter(function (v: any) {
            return v.theme == "dark";
          });
        }

        if (logos.length > 0) {
          let candidate = logos[0].formats.find(function (f: any) {
            return f.format == format;
          });

          if (candidate == undefined) {
            candidate = logos[0].formats[0];
          }

          if (candidate !== undefined) {
            return await this.logoFromSrc(candidate.src);
          }
        }
      }

      return new Uint8Array([]);
    } catch (e) {
      console.error(e);
      return new Uint8Array([]);
    }
  }
}
