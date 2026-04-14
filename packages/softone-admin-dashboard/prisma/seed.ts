import "dotenv/config"
import { PrismaClient, Prisma, MasterCategory, SoftwareType, WebCategory, DigitalToolType, IotTech, SurveySection, QuestionType } from "@prisma/client"
import bcrypt from "bcryptjs"
import { RESOURCE_KEYS } from "../lib/rbac-resources"
import { builtinPerm } from "../lib/rbac-builtins"

const db = new PrismaClient()

async function main() {
  // ─── Admin user ───────────────────────────────────────────────────────────────
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env")
  }

  const hash = await bcrypt.hash(password, 12)

  const user = await db.user.upsert({
    where: { email },
    create: {
      email,
      name: "Giannis Kozyris",
      password: hash,
      role: "ADMIN",
      emailVerified: new Date(),
    },
    update: {
      password: hash,
      role: "ADMIN",
    },
  })

  console.log(`✓ Super admin seeded: ${user.email} (role: ${user.role})`)

  // ─── Softone connection ───────────────────────────────────────────────────────
  // Credentials stored in DB only — never in env vars.
  const existing = await db.softoneConnection.findFirst({ where: { name: "DGSmart Softone" } })

  if (existing) {
    await db.softoneConnection.update({
      where: { id: existing.id },
      data: {
        baseUrl: "https://dgsoft.oncloud.gr",
        username: "dgsmart",
        password: "123dgSm@rt!@#",
        appId: "2000",
        isDefault: true,
        isActive: true,
      },
    })
    console.log(`✓ Softone connection updated (id: ${existing.id})`)
  } else {
    const conn = await db.softoneConnection.create({
      data: {
        name: "DGSmart Softone",
        baseUrl: "https://dgsoft.oncloud.gr",
        username: "dgsmart",
        password: "123dgSm@rt!@#",
        appId: "2000",
        company: "",
        branch: "",
        module: "",
        refId: "",
        isDefault: true,
        isActive: true,
      },
    })
    console.log(`✓ Softone connection created (id: ${conn.id})`)
  }

  // ─── Master Options ───────────────────────────────────────────────────────────

  const brands: { name: string; categories: MasterCategory[] }[] = [
    { name: "Cisco",       categories: [MasterCategory.NETWORKING] },
    { name: "Ubiquiti",    categories: [MasterCategory.NETWORKING] },
    { name: "Mikrotik",    categories: [MasterCategory.NETWORKING] },
    { name: "HPE Aruba",   categories: [MasterCategory.NETWORKING] },
    { name: "Fortinet",    categories: [MasterCategory.SECURITY]   },
    { name: "Sophos",      categories: [MasterCategory.SECURITY]   },
    { name: "Palo Alto",   categories: [MasterCategory.SECURITY]   },
    { name: "Check Point", categories: [MasterCategory.SECURITY]   },
    { name: "Dell",        categories: [MasterCategory.COMPUTING]  },
    { name: "HP",          categories: [MasterCategory.COMPUTING, MasterCategory.NETWORKING] },
    { name: "Lenovo",      categories: [MasterCategory.COMPUTING]  },
    { name: "Synology",    categories: [MasterCategory.STORAGE]    },
    { name: "QNAP",        categories: [MasterCategory.STORAGE]    },
    { name: "APC",         categories: [MasterCategory.POWER]      },
    { name: "Eaton",       categories: [MasterCategory.POWER]      },
    // ── VOIP Hardware ──────────────────────────────────────────────────────────
    { name: "Yealink",     categories: [MasterCategory.VOIP]       },
    { name: "Poly",        categories: [MasterCategory.VOIP]       },
    { name: "Snom",        categories: [MasterCategory.VOIP]       },
    { name: "Gigaset",     categories: [MasterCategory.VOIP]       },
    { name: "Fanvil",      categories: [MasterCategory.VOIP]       },
    { name: "Grandstream", categories: [MasterCategory.VOIP]       },
  ]
  for (const b of brands) {
    await db.brand.upsert({
      where:  { name: b.name },
      update: { categories: b.categories },
      create: { name: b.name, categories: b.categories },
    })
  }
  console.log(`✓ ${brands.length} brands seeded`)

  const assetTypes = [
    { name: "Firewall",               category: MasterCategory.SECURITY   },
    { name: "Managed Switch",         category: MasterCategory.NETWORKING },
    { name: "Wireless Access Point",  category: MasterCategory.NETWORKING },
    { name: "Physical Server",        category: MasterCategory.COMPUTING  },
    { name: "Virtual Server",         category: MasterCategory.COMPUTING  },
    { name: "NAS Storage",            category: MasterCategory.STORAGE    },
    { name: "UPS",                    category: MasterCategory.POWER      },
    { name: "IP Camera",              category: MasterCategory.IOT        },
  ]
  for (const t of assetTypes) {
    await db.assetType.upsert({ where: { name: t.name }, update: {}, create: t })
  }
  console.log(`✓ ${assetTypes.length} asset types seeded`)

  // ─── Software Vendors + Products ─────────────────────────────────────────────

  type VendorSeed = { name: string; products: { name: string; type: SoftwareType }[] }

  const vendorSeeds: VendorSeed[] = [
    {
      name: "Entersoft",
      products: [
        { name: "Entersoft Business Suite", type: SoftwareType.ERP         },
        { name: "Entersoft Expert",          type: SoftwareType.ERP         },
        { name: "Entersoft CRM",             type: SoftwareType.CRM         },
        { name: "Entersoft Retail",          type: SoftwareType.RETAIL      },
        { name: "Entersoft WMS",             type: SoftwareType.WMS         },
        { name: "Entersoft Mobile SFA",      type: SoftwareType.MOBILE_SFA  },
        { name: "Entersoft e-Invoicing",     type: SoftwareType.E_INVOICING },
        { name: "Entersoft e-Commerce",      type: SoftwareType.E_COMMERCE  },
        { name: "Entersoft HR/Payroll",      type: SoftwareType.HR_PAYROLL  },
      ],
    },
    {
      name: "SoftOne",
      products: [
        { name: "Soft1 ERP (Series 5/6)",             type: SoftwareType.ERP         },
        { name: "Soft1 Open Enterprise",               type: SoftwareType.ERP         },
        { name: "SoftOne GO",                          type: SoftwareType.ERP         },
        { name: "Soft1 CRM",                           type: SoftwareType.CRM         },
        { name: "Soft1 SFA (Mobile)",                  type: SoftwareType.MOBILE_SFA  },
        { name: "Soft1 WMS",                           type: SoftwareType.WMS         },
        { name: "Soft1 Retail",                        type: SoftwareType.RETAIL      },
        { name: "E-Invoicing (Prosvasis/SoftOne)",     type: SoftwareType.E_INVOICING },
        { name: "Soft1 BI",                            type: SoftwareType.BI_ANALYTICS},
      ],
    },
    {
      name: "SAP",
      products: [
        { name: "SAP S/4HANA",    type: SoftwareType.ERP },
        { name: "SAP Business One", type: SoftwareType.ERP },
      ],
    },
    {
      name: "Microsoft",
      products: [
        { name: "Microsoft Dynamics 365",  type: SoftwareType.ERP          },
        { name: "Microsoft 365",           type: SoftwareType.PRODUCTIVITY  },
      ],
    },
    {
      name: "Odoo",
      products: [
        { name: "Odoo ERP",  type: SoftwareType.ERP },
        { name: "Odoo CRM",  type: SoftwareType.CRM },
      ],
    },
    {
      name: "Salesforce",
      products: [
        { name: "Salesforce CRM",   type: SoftwareType.CRM },
      ],
    },
    {
      name: "HubSpot",
      products: [
        { name: "HubSpot CRM",   type: SoftwareType.CRM },
      ],
    },
    {
      name: "Veeam",
      products: [
        { name: "Veeam Backup & Replication", type: SoftwareType.BACKUP },
      ],
    },
    {
      name: "CrowdStrike",
      products: [
        { name: "CrowdStrike Falcon", type: SoftwareType.CYBERSECURITY },
      ],
    },
    {
      name: "OpenAI",
      products: [
        { name: "ChatGPT / OpenAI API", type: SoftwareType.AI_TOOL },
      ],
    },
  ]

  let totalProducts = 0
  for (const vs of vendorSeeds) {
    const vendor = await db.softwareVendor.upsert({
      where: { name: vs.name },
      update: {},
      create: { name: vs.name },
    })
    for (const p of vs.products) {
      await db.softwareProduct.upsert({
        where: { name: p.name },
        update: {},
        create: { name: p.name, type: p.type, vendorId: vendor.id },
      })
      totalProducts++
    }
  }
  console.log(`✓ ${vendorSeeds.length} software vendors + ${totalProducts} products seeded`)

  // ─── Web Platforms ────────────────────────────────────────────────────────────

  const webPlatforms = [
    { name: "WordPress",                  category: WebCategory.CMS,                  isSaaS: false },
    { name: "Wix",                        category: WebCategory.CMS,                  isSaaS: true  },
    { name: "Squarespace",                category: WebCategory.CMS,                  isSaaS: true  },
    { name: "Webflow",                    category: WebCategory.CMS,                  isSaaS: true  },
    { name: "Drupal",                     category: WebCategory.CMS,                  isSaaS: false },
    { name: "Joomla",                     category: WebCategory.CMS,                  isSaaS: false },
    { name: "Shopify",                    category: WebCategory.ECOMMERCE,            isSaaS: true  },
    { name: "WooCommerce",                category: WebCategory.ECOMMERCE,            isSaaS: false },
    { name: "Magento (Adobe Commerce)",   category: WebCategory.ECOMMERCE,            isSaaS: false },
    { name: "BigCommerce",                category: WebCategory.ECOMMERCE,            isSaaS: true  },
    { name: "PrestaShop",                 category: WebCategory.ECOMMERCE,            isSaaS: false },
    { name: "Skroutz Store",              category: WebCategory.ECOMMERCE,            isSaaS: true  },
    { name: "Contentful",                 category: WebCategory.HEADLESS_CMS,         isSaaS: true  },
    { name: "Strapi",                     category: WebCategory.HEADLESS_CMS,         isSaaS: false },
    { name: "Sanity",                     category: WebCategory.HEADLESS_CMS,         isSaaS: true  },
    { name: "Unbounce",                   category: WebCategory.LANDING_PAGE_BUILDER, isSaaS: true  },
    { name: "Leadpages",                  category: WebCategory.LANDING_PAGE_BUILDER, isSaaS: true  },
  ]
  for (const wp of webPlatforms) {
    await db.webPlatform.upsert({ where: { name: wp.name }, update: {}, create: wp })
  }
  console.log(`✓ ${webPlatforms.length} web platforms seeded`)

  // ─── Digital Tools ────────────────────────────────────────────────────────────

  const digitalTools = [
    { name: "Google Analytics 4 (GA4)",  type: DigitalToolType.ANALYTICS            },
    { name: "Matomo Analytics",           type: DigitalToolType.ANALYTICS            },
    { name: "Plausible Analytics",        type: DigitalToolType.ANALYTICS            },
    { name: "Semrush",                    type: DigitalToolType.SEO_SUITE            },
    { name: "Ahrefs",                     type: DigitalToolType.SEO_SUITE            },
    { name: "Moz Pro",                    type: DigitalToolType.SEO_SUITE            },
    { name: "Google Search Console",      type: DigitalToolType.SEO_SUITE            },
    { name: "Meta Pixel (Facebook)",      type: DigitalToolType.ADS_PLATFORM         },
    { name: "Google Ads / Tag Manager",   type: DigitalToolType.ADS_PLATFORM         },
    { name: "TikTok Pixel",               type: DigitalToolType.ADS_PLATFORM         },
    { name: "Hotjar",                     type: DigitalToolType.HEATMAP_UX           },
    { name: "Lucky Orange",               type: DigitalToolType.HEATMAP_UX           },
    { name: "Microsoft Clarity",          type: DigitalToolType.HEATMAP_UX           },
    { name: "HubSpot Marketing Hub",      type: DigitalToolType.MARKETING_AUTOMATION },
    { name: "Mailchimp",                  type: DigitalToolType.MARKETING_AUTOMATION },
    { name: "ActiveCampaign",             type: DigitalToolType.MARKETING_AUTOMATION },
  ]
  for (const dt of digitalTools) {
    await db.digitalTool.upsert({ where: { name: dt.name }, update: {}, create: dt })
  }
  console.log(`✓ ${digitalTools.length} digital tools seeded`)

  // ─── IoT Categories + Products (Milesight) ────────────────────────────────────

  const iotCategories = [
    { name: "LoRaWAN Gateways" },
    { name: "Environmental Sensing (IAQ)" },
    { name: "Smart Building & Occupancy" },
    { name: "AI People Counting (Vision)" },
    { name: "AI Security & Traffic (Vision)" },
    { name: "Industrial & Agriculture" },
  ]

  const catMap: Record<string, number> = {}
  for (const cat of iotCategories) {
    const c = await db.iotCategory.upsert({ where: { name: cat.name }, update: {}, create: cat })
    catMap[c.name] = c.id
  }
  console.log(`✓ ${iotCategories.length} IoT categories seeded`)

  const iotProducts = [
    { modelName: "UG65",             category: "LoRaWAN Gateways",               technology: IotTech.LORAWAN,    description: "Indoor Semi-Industrial Gateway" },
    { modelName: "UG67",             category: "LoRaWAN Gateways",               technology: IotTech.LORAWAN,    description: "Outdoor IP67 Gateway" },
    { modelName: "SG50",             category: "LoRaWAN Gateways",               technology: IotTech.LORAWAN,    description: "Solar Powered Gateway" },
    { modelName: "AM307",            category: "Environmental Sensing (IAQ)",     technology: IotTech.LORAWAN,    description: "7-in-1 IAQ Sensor with E-ink" },
    { modelName: "AM103",            category: "Environmental Sensing (IAQ)",     technology: IotTech.LORAWAN,    description: "3-in-1 IAQ Sensor" },
    { modelName: "AM319",            category: "Environmental Sensing (IAQ)",     technology: IotTech.LORAWAN,    description: "9-in-1 Indoor Ambience Sensor" },
    { modelName: "VS341",            category: "Smart Building & Occupancy",      technology: IotTech.LORAWAN,    description: "Desk & Seat Occupancy Sensor" },
    { modelName: "WS203",            category: "Smart Building & Occupancy",      technology: IotTech.LORAWAN,    description: "PIR & Light Occupancy Sensor" },
    { modelName: "VS133",            category: "AI People Counting (Vision)",     technology: IotTech.AI_VISION,  description: "AI ToF People Counting Sensor" },
    { modelName: "VS121",            category: "AI People Counting (Vision)",     technology: IotTech.AI_VISION,  description: "AI Workplace Occupancy Sensor" },
    { modelName: "VS135",            category: "AI People Counting (Vision)",     technology: IotTech.AI_VISION,  description: "AI 3D People Counter with Heatmap" },
    { modelName: "X1 Sensing Camera",   category: "AI Security & Traffic (Vision)", technology: IotTech.AI_VISION,  description: "Indoor AI Sensing Camera" },
    { modelName: "TrafficX Series",     category: "AI Security & Traffic (Vision)", technology: IotTech.AI_VISION,  description: "AI Road Traffic Enforcement Camera" },
    { modelName: "Pro Bullet Plus 5G",  category: "AI Security & Traffic (Vision)", technology: IotTech.FIVE_G,     description: "5G AIoT Motorized Pro Bullet Plus" },
    { modelName: "EM500-CO2",        category: "Industrial & Agriculture",        technology: IotTech.LORAWAN,    description: "Outdoor CO2 & Environment Sensor" },
    { modelName: "EM300-SLD",        category: "Industrial & Agriculture",        technology: IotTech.LORAWAN,    description: "Spot Leak Detection Sensor" },
    { modelName: "EM500-SMT",        category: "Industrial & Agriculture",        technology: IotTech.LORAWAN,    description: "Soil Moisture & Temperature Sensor" },
  ]

  for (const p of iotProducts) {
    await db.iotProduct.upsert({
      where: { modelName: p.modelName },
      update: {},
      create: { modelName: p.modelName, description: p.description, technology: p.technology, categoryId: catMap[p.category] },
    })
  }
  console.log(`✓ ${iotProducts.length} IoT products seeded`)

  // ─── Survey Question Library ─────────────────────────────────────────────────

  // optionsSource format: "<model>" or "<model>:<filter>"
  // Supported sources (resolved at runtime by the API):
  //   software_vendor              → SoftwareVendor.findMany()
  //   software_product:<type>      → SoftwareProduct.findMany({ where: { type } })
  //   web_platform                 → WebPlatform.findMany()
  //   web_platform:<category>      → WebPlatform.findMany({ where: { category } })
  //   digital_tool                 → DigitalTool.findMany()
  //   brand:<category>             → Brand.findMany({ where: { category } })
  //   iot_category                 → IotCategory.findMany()
  //   iot_product:<technology>     → IotProduct.findMany({ where: { technology } })
  // null → use static options JSON

  type QuestionSeed = {
    section: SurveySection
    key: string
    label: string
    type: QuestionType
    order: number
    optionsSource?: string
    options?: string[]
  }

  const surveyQuestions: QuestionSeed[] = [
    // ── SOFTWARE ──────────────────────────────────────────────────────────────
    {
      section: SurveySection.SOFTWARE,
      key: "erp_vendor",
      label: "Primary ERP Vendor",
      type: QuestionType.DROPDOWN,
      order: 1,
      optionsSource: "software_vendor",
    },
    {
      section: SurveySection.SOFTWARE,
      key: "erp_product",
      label: "ERP Product",
      type: QuestionType.DROPDOWN,
      order: 2,
      optionsSource: "software_product:ERP",
    },
    {
      section: SurveySection.SOFTWARE,
      key: "erp_modules",
      label: "Active ERP Modules",
      type: QuestionType.MULTI_SELECT,
      order: 3,
      // Static — module types are not a master table, just categories
      options: ["CRM", "WMS", "Retail / POS", "Mobile SFA", "E-Invoicing (AADE)", "HR / Payroll", "BI / Analytics", "E-Commerce connector"],
    },
    {
      section: SurveySection.SOFTWARE,
      key: "erp_users_count",
      label: "Number of ERP Users",
      type: QuestionType.NUMBER,
      order: 4,
    },
    {
      section: SurveySection.SOFTWARE,
      key: "crm_product",
      label: "CRM Tool in use",
      type: QuestionType.DROPDOWN,
      order: 5,
      optionsSource: "software_product:CRM",
    },
    {
      section: SurveySection.SOFTWARE,
      key: "productivity_product",
      label: "Productivity Suite",
      type: QuestionType.DROPDOWN,
      order: 6,
      optionsSource: "software_product:PRODUCTIVITY",
    },
    {
      section: SurveySection.SOFTWARE,
      key: "backup_product",
      label: "Backup Solution",
      type: QuestionType.DROPDOWN,
      order: 7,
      optionsSource: "software_product:BACKUP",
    },
    {
      section: SurveySection.SOFTWARE,
      key: "cybersecurity_products",
      label: "Cybersecurity / Endpoint Tools",
      type: QuestionType.MULTI_SELECT,
      order: 8,
      optionsSource: "software_product:CYBERSECURITY",
    },
    {
      section: SurveySection.SOFTWARE,
      key: "ai_tools_in_use",
      label: "AI Tools in use",
      type: QuestionType.MULTI_SELECT,
      order: 9,
      optionsSource: "software_product:AI_TOOL",
    },
    {
      section: SurveySection.SOFTWARE,
      key: "einvoicing_active",
      label: "E-Invoicing (MyDATA / AADE) active?",
      type: QuestionType.BOOLEAN,
      order: 10,
    },
    // ── SOFTWARE deep-dive (version lag, module utilisation, manual effort) ───
    {
      section: SurveySection.SOFTWARE,
      key: "sw_erp_db_size",
      label: "Approximate ERP Database Size",
      type: QuestionType.DROPDOWN,
      order: 11,
      options: ["< 10GB", "10GB - 50GB", "50GB+", "Unknown"],
    },
    {
      section: SurveySection.SOFTWARE,
      key: "sw_mydata_sync",
      label: "Status of AADE/myDATA Synchronization",
      type: QuestionType.DROPDOWN,
      order: 12,
      options: ["Fully Automated", "Semi-Manual", "Requires Provider (E-Invoicing)"],
    },
    {
      section: SurveySection.SOFTWARE,
      key: "sw_mobile_usage",
      label: "Are Mobile SFA/Warehouse apps used?",
      type: QuestionType.BOOLEAN,
      order: 13,
    },
    {
      section: SurveySection.SOFTWARE,
      key: "sw_custom_reports",
      label: "Does the staff use Excel for tasks the ERP could do?",
      type: QuestionType.BOOLEAN,
      order: 14,
    },
    {
      section: SurveySection.SOFTWARE,
      key: "software_pain_points",
      label: "Main software pain points / needs",
      type: QuestionType.TEXT,
      order: 15,
    },

    // ── WEB & E-COMMERCE ──────────────────────────────────────────────────────
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "web_cms_platform",
      label: "Current Website / CMS Platform",
      type: QuestionType.DROPDOWN,
      order: 1,
      optionsSource: "web_platform:CMS",
    },
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "ecommerce_active",
      label: "Is E-commerce enabled?",
      type: QuestionType.BOOLEAN,
      order: 2,
    },
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "ecommerce_platform",
      label: "E-Commerce Platform",
      type: QuestionType.DROPDOWN,
      order: 3,
      optionsSource: "web_platform:ECOMMERCE",
    },
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "ecommerce_erp_sync",
      label: "E-Commerce ↔ ERP Integration active?",
      type: QuestionType.BOOLEAN,
      order: 4,
    },
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "digital_analytics_tools",
      label: "Analytics Tools in use",
      type: QuestionType.MULTI_SELECT,
      order: 5,
      optionsSource: "digital_tool:ANALYTICS",
    },
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "digital_ads_tools",
      label: "Ad / Tracking Platforms in use",
      type: QuestionType.MULTI_SELECT,
      order: 6,
      optionsSource: "digital_tool:ADS_PLATFORM",
    },
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "digital_seo_tools",
      label: "SEO Tools in use",
      type: QuestionType.MULTI_SELECT,
      order: 7,
      optionsSource: "digital_tool:SEO_SUITE",
    },
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "digital_marketing_tools",
      label: "Marketing Automation in use",
      type: QuestionType.MULTI_SELECT,
      order: 8,
      optionsSource: "digital_tool:MARKETING_AUTOMATION",
    },
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "marketplace_presence",
      label: "Marketplace presence",
      type: QuestionType.MULTI_SELECT,
      order: 9,
      // Static — no master table for marketplaces
      options: ["Skroutz", "BestPrice", "Amazon.gr", "eBay", "Public.gr", "None"],
    },
    // ── WEB deep-dive (integration, performance, revenue risk) ───────────────
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "web_erp_integration",
      label: "Web-to-ERP Inventory Sync Frequency",
      type: QuestionType.DROPDOWN,
      order: 10,
      options: ["Real-time", "Hourly", "Daily", "Manual Update"],
    },
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "web_payment_providers",
      label: "Current Payment Gateways",
      type: QuestionType.MULTI_SELECT,
      order: 11,
      options: ["Everypay", "Viva Wallet", "Stripe", "PayPal", "Bank Transfer Only"],
    },
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "web_page_speed",
      label: "Average Mobile Load Time (observed)",
      type: QuestionType.DROPDOWN,
      order: 12,
      options: ["< 2s (Excellent)", "2s-5s (Average)", "> 5s (Poor)"],
    },
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "web_marketing_consent",
      label: "GDPR-Compliant Cookie/Consent Management?",
      type: QuestionType.BOOLEAN,
      order: 13,
    },
    {
      section: SurveySection.WEB_ECOMMERCE,
      key: "web_pain_points",
      label: "Main web / digital pain points",
      type: QuestionType.TEXT,
      order: 14,
    },

    // ── IOT & AI ──────────────────────────────────────────────────────────────
    {
      section: SurveySection.IOT_AI,
      key: "iot_categories_interest",
      label: "IoT / Smart Building areas of interest",
      type: QuestionType.MULTI_SELECT,
      order: 1,
      optionsSource: "iot_category",
    },
    {
      section: SurveySection.IOT_AI,
      key: "lorawan_gateways",
      label: "LoRaWAN Gateways in use",
      type: QuestionType.MULTI_SELECT,
      order: 2,
      optionsSource: "iot_product:LORAWAN",
    },
    {
      section: SurveySection.IOT_AI,
      key: "ai_vision_products",
      label: "AI Vision / Computer Vision devices needed",
      type: QuestionType.MULTI_SELECT,
      order: 3,
      optionsSource: "iot_product:AI_VISION",
    },
    {
      section: SurveySection.IOT_AI,
      key: "iot_platform",
      label: "IoT Platform / Dashboard",
      type: QuestionType.DROPDOWN,
      order: 4,
      // Static — no master table for IoT cloud platforms
      options: ["Milesight DeviceHub", "The Things Network", "AWS IoT", "Azure IoT Hub", "Custom", "None"],
    },
    // ── IoT deep-dive (Milesight deployment, Vision ROI) ─────────────────────
    {
      section: SurveySection.IOT_AI,
      key: "iot_milesight_range",
      label: "Coverage area for LoRaWAN (m²)",
      type: QuestionType.NUMBER,
      order: 5,
    },
    {
      section: SurveySection.IOT_AI,
      key: "iot_vision_lighting",
      label: "Ambient Lighting Condition for AI Vision",
      type: QuestionType.DROPDOWN,
      order: 6,
      options: ["Constant/Indoor", "Variable Outdoor", "Low Light/Infrared required"],
    },
    {
      section: SurveySection.IOT_AI,
      key: "iot_alert_type",
      label: "How should IoT alerts be received?",
      type: QuestionType.MULTI_SELECT,
      order: 7,
      options: ["Email", "SMS", "Push Notification", "ERP Dashboard Integration"],
    },
    {
      section: SurveySection.IOT_AI,
      key: "ai_data_privacy",
      label: "Is AI Video Analytics strictly anonymous (ToF)?",
      type: QuestionType.BOOLEAN,
      order: 8,
    },
    {
      section: SurveySection.IOT_AI,
      key: "iot_pain_points",
      label: "Main IoT / AI pain points or requirements",
      type: QuestionType.TEXT,
      order: 9,
    },

    // ── HARDWARE & NETWORK ────────────────────────────────────────────────────
    // Deactivated — replaced by DEVICE_LIST equivalents below
    { section: SurveySection.HARDWARE_NETWORK, key: "firewall_brand",  label: "Perimeter Security (Firewall) Brand",  type: QuestionType.DROPDOWN,      order: 1,  optionsSource: "brand:SECURITY",  isActive: false },
    { section: SurveySection.HARDWARE_NETWORK, key: "switching_brand", label: "Core Switching / Networking Brand",     type: QuestionType.DROPDOWN,      order: 2,  optionsSource: "brand:NETWORKING", isActive: false },
    { section: SurveySection.HARDWARE_NETWORK, key: "wifi_brand",      label: "Wi-Fi / Wireless Brand",               type: QuestionType.DROPDOWN,      order: 3,  optionsSource: "brand:NETWORKING", isActive: false },
    { section: SurveySection.HARDWARE_NETWORK, key: "server_count",    label: "Number of Physical Servers",           type: QuestionType.NUMBER,        order: 4,  isActive: false },
    { section: SurveySection.HARDWARE_NETWORK, key: "server_brand",    label: "Server Brand(s)",                      type: QuestionType.MULTI_SELECT,  order: 5,  optionsSource: "brand:COMPUTING",  isActive: false },
    { section: SurveySection.HARDWARE_NETWORK, key: "nas_brand",       label: "NAS / Storage Brand",                  type: QuestionType.DROPDOWN,      order: 7,  optionsSource: "brand:STORAGE",    isActive: false },
    { section: SurveySection.HARDWARE_NETWORK, key: "ups_brand",       label: "UPS / Power Protection Brand",         type: QuestionType.DROPDOWN,      order: 8,  optionsSource: "brand:POWER",      isActive: false },

    // ── DEVICE_LIST — per-device inventory with brand/model/serial/location/IP ─
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "firewall_devices",
      label: "Firewall / Perimeter Security Devices",
      type: QuestionType.DEVICE_LIST,
      order: 1,
      options: { hasIp: true } as any,
    },
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "switching_devices",
      label: "Network Switches",
      type: QuestionType.DEVICE_LIST,
      order: 2,
      options: { hasIp: true } as any,
    },
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "wifi_devices",
      label: "Wi-Fi Access Points",
      type: QuestionType.DEVICE_LIST,
      order: 3,
      options: { hasIp: true } as any,
    },
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "server_devices",
      label: "Physical Servers",
      type: QuestionType.DEVICE_LIST,
      order: 4,
      options: { hasIp: true } as any,
    },
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "nas_devices",
      label: "NAS / Storage Devices",
      type: QuestionType.DEVICE_LIST,
      order: 5,
      options: { hasIp: true } as any,
    },
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "ups_devices",
      label: "UPS / Power Protection Units",
      type: QuestionType.DEVICE_LIST,
      order: 6,
      options: { hasIp: false } as any,
    },
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "workstation_count",
      label: "Number of Workstations / Desktops",
      type: QuestionType.NUMBER,
      order: 7,
    },
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "virtualization",
      label: "Virtualization Platform",
      type: QuestionType.DROPDOWN,
      order: 8,
      // Static — no master table for hypervisors
      options: ["VMware vSphere / ESXi", "Hyper-V", "Proxmox VE", "Nutanix", "None (bare metal only)"],
    },
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "cloud_services",
      label: "Cloud Services in use",
      type: QuestionType.MULTI_SELECT,
      order: 10,
      // Static — no master table for cloud providers
      options: ["Microsoft Azure", "AWS", "Google Cloud", "Hetzner / OVH", "Local colocation only", "None"],
    },
    // ── HARDWARE deep-dive (redundancy, lifecycle, bottlenecks) ──────────────
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "hw_internet_failover",
      label: "Is there a secondary ISP (Failover) or 5G backup?",
      type: QuestionType.BOOLEAN,
      order: 11,
    },
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "hw_switching_speed",
      label: "Core Switch Backplane Speed",
      type: QuestionType.DROPDOWN,
      order: 12,
      options: ["1Gbps (Standard)", "10Gbps (Fiber Backbone)", "Legacy/Mixed"],
    },
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "hw_server_storage_type",
      label: "Server Storage Architecture",
      type: QuestionType.DROPDOWN,
      order: 13,
      options: ["Local RAID", "NAS/SAN (Shared)", "Cloud Native", "No Redundancy"],
    },
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "hw_wifi_security",
      label: "Wireless Authentication Method",
      type: QuestionType.DROPDOWN,
      order: 14,
      options: ["Shared WPA2 Key", "WPA3 Enterprise (RADIUS)", "Open/Unsecured"],
    },
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "hw_backup_retention",
      label: "Backup Retention Policy (RPO)",
      type: QuestionType.DROPDOWN,
      order: 15,
      options: ["Last 24 hours only", "7-Day Rotation", "3-2-1 Rule (Local+Offsite+Cloud)"],
    },
    {
      section: SurveySection.HARDWARE_NETWORK,
      key: "hardware_pain_points",
      label: "Main hardware / network pain points",
      type: QuestionType.TEXT,
      order: 16,
    },

    // ── VOIP TELEPHONY ────────────────────────────────────────────────────────

    // --- Current Telephony ---
    {
      section: SurveySection.VOIP,
      key: "voip_current_system",
      label: "Current Phone System Type",
      type: QuestionType.DROPDOWN,
      order: 1,
      options: ["Legacy PBX (Analog/ISDN)", "On-Premise IP-PBX", "Hosted/Cloud VOIP", "Mobile Only"],
    },
    {
      section: SurveySection.VOIP,
      key: "voip_number_porting",
      label: "How many numbers need to be ported (LNP)?",
      type: QuestionType.NUMBER,
      order: 2,
    },

    // --- Network Readiness ---
    {
      section: SurveySection.VOIP,
      key: "voip_qos_enabled",
      label: "Does current networking gear support Quality of Service (QoS)?",
      type: QuestionType.BOOLEAN,
      order: 3,
    },
    {
      section: SurveySection.VOIP,
      key: "voip_poe_switches",
      label: "Are current switches PoE (Power over Ethernet)?",
      type: QuestionType.BOOLEAN,
      order: 4,
    },
    {
      section: SurveySection.VOIP,
      key: "voip_upload_bandwidth",
      label: "Measured Upload Speed (Mbps)",
      type: QuestionType.NUMBER,
      order: 5,
    },

    // --- Device & User Personas ---
    {
      section: SurveySection.VOIP,
      key: "voip_handset_count",
      label: "Total Physical Handsets Required",
      type: QuestionType.NUMBER,
      order: 6,
    },
    {
      section: SurveySection.VOIP,
      key: "voip_softphone_users",
      label: "Number of users requiring Mobile/PC apps (Softphones)",
      type: QuestionType.NUMBER,
      order: 7,
    },

    // --- Legacy / Hidden Triggers ---
    {
      section: SurveySection.VOIP,
      key: "voip_analog_devices",
      label: "Legacy Analog Devices (Elevators, Alarms, Fax, Door Entry)",
      type: QuestionType.MULTI_SELECT,
      order: 8,
      options: ["Elevator Phone", "Fire Alarm Line", "Analog Fax Machine", "Intercom/Gate"],
    },
    {
      section: SurveySection.VOIP,
      key: "voip_ivr_complexity",
      label: "Call Routing Needs",
      type: QuestionType.MULTI_SELECT,
      order: 9,
      options: ["Simple Auto-Attendant", "Hunt Groups", "Call Queuing (Call Center)", "CRM Integration (Pop-up)"],
    },

    // --- Hardware Preferences ---
    {
      section: SurveySection.VOIP,
      key: "voip_preferred_brand",
      label: "Preferred VOIP Hardware Brand",
      type: QuestionType.DROPDOWN,
      order: 10,
      optionsSource: "brand:VOIP",
    },
    {
      section: SurveySection.VOIP,
      key: "voip_handset_devices",
      label: "Existing IP Handsets / VOIP Devices Inventory",
      type: QuestionType.DEVICE_LIST,
      order: 11,
      options: { hasIp: true } as any,
    },
    {
      section: SurveySection.VOIP,
      key: "voip_pain_points",
      label: "Main telephony pain points / requirements",
      type: QuestionType.TEXT,
      order: 12,
    },
  ]

  for (const q of surveyQuestions) {
    const isActive = (q as any).isActive !== undefined ? (q as any).isActive : true
    await db.surveyQuestion.upsert({
      where: { key: q.key },
      update: {
        label: q.label,
        section: q.section,
        type: q.type,
        order: q.order,
        optionsSource: q.optionsSource ?? null,
        options: q.options ?? Prisma.JsonNull,
        isActive,
      },
      create: {
        section: q.section,
        key: q.key,
        label: q.label,
        type: q.type,
        order: q.order,
        optionsSource: q.optionsSource ?? null,
        options: q.options ?? Prisma.JsonNull,
        isActive,
      },
    })
  }
  console.log(`✓ ${surveyQuestions.length} survey questions seeded`)

  // ─── Default RolePermission rows (only if table empty) ───────────────────────
  const permCount = await db.rolePermission.count()
  if (permCount === 0) {
    for (const role of ["OPERATOR", "VIEWER"] as const) {
      for (const resource of RESOURCE_KEYS) {
        const p = builtinPerm(role, resource)
        await db.rolePermission.create({
          data: { role, resource, ...p },
        })
      }
    }
    console.log("✓ RolePermission defaults seeded for OPERATOR + VIEWER")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
