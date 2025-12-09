// Shared utilities for PerfectGym API integration

export function mapMembershipType(paymentPlanName: string): string {
  const name = (paymentPlanName || '').toLowerCase();
  
  if (name.includes('loyalty')) {
    return 'loyalty';
  } else if (name.includes('flex')) {
    return 'flex';
  }
  // Default to 'flex' for other membership types
  return 'flex';
}

type Platform = 'DE' | 'NL' | 'CH' | 'AT';

export interface PerfectGymConfig {
  clientId: string;
  clientSecret: string;
  apiUrl: string;
}

// Map city names to country codes
const cityToCountry: Record<string, string> = {
  'amsterdam': 'NL',
  'antwerp': 'NL',
  'antwerpen': 'NL',
  'rotterdam': 'NL',
  'berlin': 'DE',
  'cologne': 'DE',
  'munich': 'DE',
  'basel': 'CH',
  'zurich': 'CH',
  'vienna': 'AT',
};

// Map homeClubId to city name per country/platform
const homeClubIdToCity: Record<string, Record<number, string>> = {
  'NL': {
    1: 'amsterdam',
    5: 'rotterdam',
    6: 'antwerpen',
  },
  'DE': {
    1: 'berlin',
    5: 'cologne',
    6: 'munich',
  },
  'CH': {
    1: 'zurich',
    4: 'basel',
  },
  'AT': {
    1: 'vienna',
  },
};

export function getCityFromHomeClubId(country: string, homeClubId: number | undefined): string | null {
  if (!homeClubId) return null;
  const countryMapping = homeClubIdToCity[country];
  if (!countryMapping) return null;
  return countryMapping[homeClubId] || null;
}

// Map country codes to platform codes
const countryToPlatform: Record<string, Platform> = {
  'NL': 'NL',
  'DE': 'DE',
  'CH': 'CH',
  'AT': 'AT',
};

function getPlatforms() {
  return {
    DE: {
      clientId: process.env.PERFECTGYM_DE_CLIENT_ID || '',
      clientSecret: process.env.PERFECTGYM_DE_CLIENT_SECRET || '',
      apiUrl: process.env.PERFECTGYM_DE_API_URL || 'https://12rounds-de.perfectgym.com',
    },
    NL: {
      clientId: process.env.PERFECTGYM_NL_CLIENT_ID || '',
      clientSecret: process.env.PERFECTGYM_NL_CLIENT_SECRET || '',
      apiUrl: process.env.PERFECTGYM_NL_API_URL || 'https://boxingcommunity.perfectgym.com',
    },
    CH: {
      clientId: process.env.PERFECTGYM_CH_CLIENT_ID || '',
      clientSecret: process.env.PERFECTGYM_CH_CLIENT_SECRET || '',
      apiUrl: process.env.PERFECTGYM_CH_API_URL || 'https://12rounds-ch.perfectgym.com',
    },
    AT: {
      clientId: process.env.PERFECTGYM_AT_CLIENT_ID || '',
      clientSecret: process.env.PERFECTGYM_AT_CLIENT_SECRET || '',
      apiUrl: process.env.PERFECTGYM_AT_API_URL || 'https://12rounds-at.perfectgym.com',
    },
  } as const;
}

export function getCountryFromCity(city: string): string | null {
  const normalizedCity = city.toLowerCase().trim();
  return cityToCountry[normalizedCity] || null;
}

export async function getPerfectGymConfig(country: string): Promise<PerfectGymConfig | null> {
  const platform = countryToPlatform[country];
  if (!platform) {
    console.warn(`Unknown country code: ${country}`);
    return null;
  }

  const platforms = getPlatforms();
  const platformConfig = platforms[platform as Platform];
  if (!platformConfig) {
    console.warn(`No platform config found for: ${platform}`);
    return null;
  }

  // Validate that credentials are present
  if (!platformConfig.clientId || !platformConfig.clientSecret) {
    console.error(`Missing credentials for platform: ${String(platform)}. Please check your environment variables.`);
    return null;
  }

  return {
    clientId: platformConfig.clientId,
    clientSecret: platformConfig.clientSecret,
    apiUrl: platformConfig.apiUrl,
  };
}

export async function checkMemberMembership(
  config: PerfectGymConfig,
  memberId: string
): Promise<{ hasMembership: boolean; membershipType?: string; memberSince?: string }> {
  try {
    // Check for active contracts (memberships)
    const contractsUrl = `${config.apiUrl}/Api/v2.2/odata/Contracts?$filter=MemberId eq ${memberId} and IsActive eq true&$expand=PaymentPlan($expand=MembershipType)&$orderby=StartDate desc&$top=1`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(contractsUrl, {
      headers: {
        'x-Client-id': config.clientId,
        'x-Client-Secret': config.clientSecret,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return { hasMembership: false };
      }
      console.error(`Failed to fetch contracts for member ${memberId}: ${response.status}`);
      return { hasMembership: false };
    }

    const data = await response.json();
    
    if (data && data.value && data.value.length > 0) {
      const contract = data.value[0];
      const paymentPlan = contract.PaymentPlan || contract.paymentPlan;
      const paymentPlanName = (paymentPlan?.Name || paymentPlan?.name || '').toLowerCase();
      
      let membershipType = 'flex'; // default
      if (paymentPlanName.includes('loyalty')) {
        membershipType = 'loyalty';
      }

      return {
        hasMembership: true,
        membershipType,
        memberSince: contract.StartDate || contract.startDate,
      };
    }

    return { hasMembership: false };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Timeout checking membership for member ${memberId}`);
    } else {
      console.error(`Error checking membership for member ${memberId}:`, error);
    }
    return { hasMembership: false };
  }
}

export async function getMemberProducts(
  config: PerfectGymConfig,
  memberId: string
): Promise<{ currentQuantity: number | null; initialQuantity: number | null; purchaseDate: string | null }> {
  try {
    // Get member products with initialQuantity 10 or 16 (course packages)
    // Note: We don't filter on isDeleted here because we want the newest product even if deleted
    const productsUrl = `${config.apiUrl}/Api/v2.2/odata/MemberProducts?$filter=MemberId eq ${memberId} and (initialQuantity eq 10 or initialQuantity eq 16)&$orderby=PurchaseDate desc&$top=1`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(productsUrl, {
      headers: {
        'x-Client-id': config.clientId,
        'x-Client-Secret': config.clientSecret,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return { currentQuantity: null, initialQuantity: null, purchaseDate: null };
      }
      console.error(`Failed to fetch member products for member ${memberId}: ${response.status}`);
      return { currentQuantity: null, initialQuantity: null, purchaseDate: null };
    }

    const data = await response.json();
    
    if (data && data.value && data.value.length > 0) {
      const product = data.value[0];
      return {
        currentQuantity: product.CurrentQuantity || product.currentQuantity || null,
        initialQuantity: product.InitialQuantity || product.initialQuantity || null,
        purchaseDate: product.PurchaseDate || product.purchaseDate || null,
      };
    }

    return { currentQuantity: null, initialQuantity: null, purchaseDate: null };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Timeout fetching member products for member ${memberId}`);
    } else {
      console.error(`Error fetching member products for member ${memberId}:`, error);
    }
    return { currentQuantity: null, initialQuantity: null, purchaseDate: null };
  }
}

export interface MemberProduct {
  memberId: number;
  initialQuantity: number;
  currentQuantity: number;
  purchaseDate: string;
  isDeleted: boolean;
  Member?: {
    id: number;
    number: string;
    homeClubId: number;
  };
}

export async function getAllMemberProducts(
  config: PerfectGymConfig
): Promise<MemberProduct[]> {
  try {
    // Get all member products with initialQuantity 10 or 16 (course packages)
    // Expand Member to get member info
        // Try to get homeClubId via Member expand
        // Note: homeClubId might be in Member or we might need to use clubId from MemberProducts itself
        let productsUrl = `${config.apiUrl}/Api/v2.2/odata/MemberProducts?$filter=(initialQuantity eq 10 or initialQuantity eq 16)&$expand=Member($select=id,number,homeClubId)&$select=MemberId,InitialQuantity,CurrentQuantity,PurchaseDate,IsDeleted,ClubId`;
    
    const allProducts: MemberProduct[] = [];
    let hasMorePages = true;

    while (hasMorePages) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for bulk query
      
      const response = await fetch(productsUrl, {
        headers: {
          'x-Client-id': config.clientId,
          'x-Client-Secret': config.clientSecret,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Failed to fetch member products: ${response.status}`);
        break;
      }

      const data = await response.json();
      
      if (data && data.value && data.value.length > 0) {
        const pageProducts = data.value.map((product: any) => {
          // Debug: log first product to see structure
          if (allProducts.length === 0) {
            console.log('[getAllMemberProducts] Sample product data:', JSON.stringify({
              MemberId: product.MemberId,
              ClubId: product.ClubId,
              Member: product.Member,
            }, null, 2));
          }
          
          // Try to get homeClubId from:
          // 1. Member.HomeClubId (from expand)
          // 2. Product.ClubId (directly on the product)
          const homeClubId = product.Member?.HomeClubId || 
                            product.Member?.homeClubId || 
                            product.ClubId || 
                            product.clubId ||
                            product.Member?.HomeClub?.Id ||
                            product.Member?.homeClub?.id;
          
          return {
            memberId: product.MemberId || product.memberId,
            initialQuantity: product.InitialQuantity || product.initialQuantity,
            currentQuantity: product.CurrentQuantity || product.currentQuantity,
            purchaseDate: product.PurchaseDate || product.purchaseDate,
            isDeleted: product.IsDeleted || product.isDeleted || false,
            Member: product.Member ? {
              id: product.Member.Id || product.Member.id,
              number: product.Member.Number || product.Member.number,
              homeClubId: homeClubId,
            } : (homeClubId ? {
              id: product.MemberId || product.memberId,
              number: '',
              homeClubId: homeClubId,
            } : undefined),
          };
        });
        allProducts.push(...pageProducts);
      }

      // Check for next page
      const nextLink = data['@odata.nextLink'];
      if (nextLink) {
        productsUrl = nextLink;
      } else {
        hasMorePages = false;
      }
    }

    return allProducts;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Timeout fetching all member products`);
    } else {
      console.error(`Error fetching all member products:`, error);
    }
    return [];
  }
}

export interface MemberWithContract {
  id: number;
  memberType: string;
  contracts: Array<{
    isActive: boolean;
    startDate: string;
    status: string;
    memberId: number;
    paymentPlanName?: string;
  }>;
}

export async function getAllMembersWithContracts(
  config: PerfectGymConfig
): Promise<MemberWithContract[]> {
  try {
    // Get all Members (not Guests) with their contracts
    // Order by startDate desc + top 1: newest contract per member (active or ended)
    // Expand PaymentPlan to get Name for membership type determination
    let membersUrl = `${config.apiUrl}/Api/v2.2/odata/Members?$filter=memberType eq 'Member'&$expand=Contracts($orderby=startDate desc;$top=1;$expand=PaymentPlan($select=Name))`;
    
    const allMembers: MemberWithContract[] = [];
    let hasMorePages = true;

    while (hasMorePages) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for bulk query
      
      const response = await fetch(membersUrl, {
        headers: {
          'x-Client-id': config.clientId,
          'x-Client-Secret': config.clientSecret,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Failed to fetch members with contracts: ${response.status}`);
        break;
      }

      const data = await response.json();
      
      if (data && data.value && data.value.length > 0) {
        const pageMembers = data.value.map((member: any) => ({
          id: member.Id || member.id,
          memberType: member.MemberType || member.memberType,
          contracts: (member.Contracts || member.contracts || []).map((contract: any) => {
            const paymentPlan = contract.PaymentPlan || contract.paymentPlan;
            const paymentPlanName = paymentPlan?.Name || paymentPlan?.name || '';
            
            return {
              isActive: contract.IsActive || contract.isActive,
              startDate: contract.StartDate || contract.startDate,
              status: contract.Status || contract.status,
              memberId: contract.MemberId || contract.memberId,
              paymentPlanName: paymentPlanName,
            };
          }),
        }));
        allMembers.push(...pageMembers);
      }

      // Check for next page
      const nextLink = data['@odata.nextLink'];
      if (nextLink) {
        membersUrl = nextLink;
      } else {
        hasMorePages = false;
      }
    }

    return allMembers;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Timeout fetching all members with contracts`);
    } else {
      console.error(`Error fetching all members with contracts:`, error);
    }
    return [];
  }
}

