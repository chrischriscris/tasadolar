import { rateDefinitions, type RateId } from "./rate-definitions";

export type RateRoute = {
  slug: string;
  id: RateId;
  title: string;
  navLabel: string;
  inputSymbol: string;
  inputLabel: string;
};

export const rateRoutes = rateDefinitions.map(
  ({ slug, id, title, navLabel, inputSymbol, inputLabel }) => ({
    slug,
    id,
    title,
    navLabel,
    inputSymbol,
    inputLabel,
  }),
) satisfies RateRoute[];
