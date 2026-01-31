import { Router } from 'express';
import { getSuggestions } from '../controllers/funds.simple';

const router = Router();

// GET /suggest?q=sb - Autocomplete/fuzzy search
// Used in: Fund Compare, Fund Overlap, Search bar autocomplete
router.get('/', getSuggestions);

export default router;
