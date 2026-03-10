// ---------------------------------------------------------------------------
// Shared types for exchange rate fetching
// ---------------------------------------------------------------------------

/** Successful rate fetch */
export interface RateResult {
  price: number;
  updatedAt: string;
  source: string;
  error?: undefined;
}

/** Failed rate fetch */
export interface RateError {
  price?: undefined;
  updatedAt?: undefined;
  source: string;
  error: string;
}

/** Discriminated union – check `.error` to narrow */
export type Rate = RateResult | RateError;

// -- DolarApi.com response shape (ve.dolarapi.com) --------------------------

export interface DolarApiResponse {
  fuente: string;
  nombre: string;
  moneda?: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
}

// -- Binance P2P response shapes --------------------------------------------

export interface BinanceP2PAd {
  adv: {
    price: string;
    surplusAmount: string;
    maxSingleTransAmount: string;
    minSingleTransAmount: string;
  };
  advertiser: {
    nickName: string;
    monthOrderCount: number;
    monthFinishRate: number;
  };
}

export interface BinanceP2PResponse {
  code: string;
  data: BinanceP2PAd[];
  total: number;
  success: boolean;
}
