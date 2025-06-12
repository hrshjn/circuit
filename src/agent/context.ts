import { URL } from 'url';
import fs from 'fs';
import path from 'path';

export interface WebsiteContext {
  domain: string;
  description: string;
  primaryFeatures: string[];
  suggestedSearchTerms: string[];
  suggestedActions: string[];
}

/**
 * Get context about a website from pre-generated context files
 */
export async function getWebsiteContext(url: string): Promise<WebsiteContext | null> {
  const domain = new URL(url).hostname;
  
  try {
    console.log(`[CONTEXT] Getting context for ${domain}...`);
    
    // First, try to load from context file
    const contextFile = path.join(process.cwd(), 'contexts', `${domain}.json`);
    if (fs.existsSync(contextFile)) {
      const contextData = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      console.log(`[CONTEXT] Loaded context from file for ${domain}:`, contextData.description);
      return { domain, ...contextData };
    }
    
    // If no context file exists, log a message
    console.log(`[CONTEXT] No context file found for ${domain}. Run 'pnpm get-context ${url}' to generate one.`);
    
    // Generic fallback
    return {
      domain,
      description: `${domain} website`,
      primaryFeatures: ['Navigation', 'Search', 'User actions'],
      suggestedSearchTerms: ['search', 'find', 'view'],
      suggestedActions: ['Browse', 'Search', 'Navigate']
    };

  } catch (error) {
    console.error('[CONTEXT] Failed to get website context:', error);
    return null;
  }
}

/**
 * Get appropriate form fill values based on context
 */
export function getContextualFormValue(
  inputType: string,
  inputName: string,
  placeholder: string,
  context: WebsiteContext | null
): string {
  const name = inputName.toLowerCase();
  const placeholderLower = placeholder.toLowerCase();

  // Email fields
  if (inputType === 'email' || name.includes('email')) {
    return 'test@example.com';
  }

  // Password fields
  if (inputType === 'password' || name.includes('password')) {
    return 'TestPassword123!';
  }

  // Search fields - use context-aware search terms
  if (inputType === 'search' || name.includes('search') || placeholderLower.includes('search')) {
    if (context?.suggestedSearchTerms.length) {
      // Pick a relevant search term based on the domain
      const searchTerms = context.suggestedSearchTerms;
      // Rotate through search terms based on some randomness or pick the first one
      const searchTerm = searchTerms[Math.floor(Math.random() * Math.min(3, searchTerms.length))];
      console.log(`[CONTEXT] Using contextual search term: "${searchTerm}"`);
      return searchTerm;
    }
    return 'test search';
  }

  // Phone number fields
  if (name.includes('phone') || name.includes('mobile') || placeholderLower.includes('phone')) {
    return '+919876543210';
  }

  // Name fields
  if (name.includes('name') || placeholderLower.includes('name')) {
    if (name.includes('first')) return 'Test';
    if (name.includes('last')) return 'User';
    return 'Test User';
  }

  // Amount/price fields (common in payment gateways)
  if (name.includes('amount') || name.includes('price') || placeholderLower.includes('amount')) {
    return '100';
  }

  // Date fields
  if (inputType === 'date' || name.includes('date')) {
    return new Date().toISOString().split('T')[0];
  }

  // Default fallback
  return 'test input';
} 