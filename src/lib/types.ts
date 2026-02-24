export interface RateResult {
  price: number;
  updatedAt: string;
  source: string;
  error?: undefined;
}

export interface RateError {
  price?: undefined;
  updatedAt?: undefined;
  source: string;
  error: string;
}

export type Rate = RateResult | RateError;

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

export interface DolarApiResponse {
  fuente: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
}
