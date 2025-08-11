import { DiZhi, TianGan } from "./types.js";
import { DIZHI_ORDER, GAN_JI_GONG } from "./core.js";
import { PlateResolver, SymbolLike } from "./engine.js";

export function createCircularPlateResolver(direction: "forward" | "backward" = "forward"): PlateResolver {
  const step = direction === "forward" ? 1 : -1;
  const nextZhi = (z: DiZhi): DiZhi => {
    const i = DIZHI_ORDER.indexOf(z);
    const ni = (i + step + 12) % 12;
    return DIZHI_ORDER[ni];
  };
  return {
    shangShen(sym: SymbolLike): SymbolLike {
      const asZhi = (DIZHI_ORDER as unknown as string[]).includes(sym as string)
        ? (sym as DiZhi)
        : GAN_JI_GONG[sym as TianGan];
      return nextZhi(asZhi);
    },
  };
}

export function createChainPlateResolver(chain: { chu: DiZhi; zhong: DiZhi; mo: DiZhi }, fallback: PlateResolver = createCircularPlateResolver("forward")): PlateResolver {
  return {
    shangShen(sym: SymbolLike): SymbolLike {
      if (sym === chain.chu) return chain.zhong;
      if (sym === chain.zhong) return chain.mo;
      return fallback.shangShen(sym);
    },
  };
}

