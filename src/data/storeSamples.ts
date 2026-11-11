import { BoundingBoxPct } from '../components/MediaPipeOfferCanvas.tsx';

export interface StoreOfferSample {
  id: 'elektra' | 'max' | 'walmart';
  tienda: string;
  dominio: string;
  producto: string;
  resumenCorto: string;
  imageSrc: string;
  precioContado: number;
  montoCuota: number;
  numeroPagos: number;
  frecuencia: 'semanal' | 'mensual';
  contadoBoxPct: BoundingBoxPct;
  cuotasBoxPct: BoundingBoxPct;
  veredictoFijo?: {
    conveniente: boolean;
    badge: string;
    titulo: string;
    explicacion: string;
    recomendacion: string;
  };
}

export const STORE_OFFER_SAMPLES: StoreOfferSample[] = [
  {
    id: 'elektra',
    tienda: 'Elektra Guatemala',
    dominio: 'elektra.com.gt',
    producto: 'Tablet Xiaomi Redmi Pad 2 Pro 8GB/256GB',
    resumenCorto: 'Contado Q 2,499 vs. 104 abonos semanales de Q 48',
    imageSrc: '/samples/oferta-elektra.png',
    precioContado: 2499,
    montoCuota: 48,
    numeroPagos: 104,
    frecuencia: 'semanal',
    contadoBoxPct: { x: 0.045, y: 0.59, w: 0.91, h: 0.12 },
    cuotasBoxPct: { x: 0.045, y: 0.725, w: 0.91, h: 0.19 },
    veredictoFijo: {
      conveniente: false,
      badge: 'NO TE CONVIENE A CUOTAS',
      titulo: 'Terminas pagando Q 2,493 de más',
      explicacion:
        'En abonos semanales pagas casi el doble de lo que vale la tablet al contado (Q 4,992 en total en vez de Q 2,499).',
      recomendacion:
        'Si no tienes los Q 2,499 hoy, ahorrar Q 209 al mes por tu cuenta te permite comprarla en 1 año ahorrándote Q 2,493.',
    },
  },
  {
    id: 'max',
    tienda: 'Tiendas MAX',
    dominio: 'max.com.gt',
    producto: 'Samsung Galaxy A37 5G 128GB',
    resumenCorto: 'Oferta Q 2,996 vs. 12 cuotas de Q 343/mes',
    imageSrc: '/samples/oferta-max.png',
    precioContado: 2996,
    montoCuota: 343,
    numeroPagos: 12,
    frecuencia: 'mensual',
    contadoBoxPct: { x: 0.045, y: 0.645, w: 0.91, h: 0.115 },
    cuotasBoxPct: { x: 0.045, y: 0.78, w: 0.91, h: 0.185 },
    veredictoFijo: {
      conveniente: false,
      badge: 'NO TE CONVIENE A CUOTAS',
      titulo: 'Terminas pagando Q 1,120 de más',
      explicacion:
        'Al pedir cuotas pierdes el descuento de contado y te suman Q 420 de seguro obligatorio durante el año.',
      recomendacion:
        'Pide en mostrador que dividan los Q 2,996 de oferta sin seguro obligatorio, o págala al contado para ahorrarte Q 1,120.',
    },
  },
  {
    id: 'walmart',
    tienda: 'Walmart Guatemala',
    dominio: 'walmart.com.gt',
    producto: 'Pantalla Samsung 65" 4K UHD UN65U8000',
    resumenCorto: 'Oferta Q 3,895.50 en 12 cuotas sin intereses de Q 324.63/mes',
    imageSrc: '/samples/oferta-walmart.png',
    precioContado: 3895.5,
    montoCuota: 324.63,
    numeroPagos: 12,
    frecuencia: 'mensual',
    contadoBoxPct: { x: 0.045, y: 0.645, w: 0.91, h: 0.115 },
    cuotasBoxPct: { x: 0.045, y: 0.78, w: 0.91, h: 0.185 },
    veredictoFijo: {
      conveniente: true,
      badge: 'SÍ TE CONVIENE A CUOTAS',
      titulo: 'Pagas exactamente lo mismo (Q 0 extra)',
      explicacion:
        'Te respetan el precio de oferta de Q 3,895.50 dividido en 12 pagos iguales sin seguros ni recargos escondidos.',
      recomendacion:
        'Aprovecha las 12 cuotas sin intereses y paga a tiempo cada mes para conservar tu efectivo sin pagar un centavo extra.',
    },
  },
];
