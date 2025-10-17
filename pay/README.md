# Minilend Pay - Stablecoins to Mobile Money

Standalone offramp application for converting stablecoins to mobile money across Africa.

## Features

- Convert cUSD, USDT, USDC to local currency
- Support for 7 African countries (Kenya, Nigeria, Ghana, Uganda, DR Congo, Malawi, Ethiopia)
- Mobile money integration via Pretium API
- Real-time exchange rates
- Account validation before payment

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env.local`:
```
PRETIUM_BASE_URI=https://api.xwift.africa
PRETIUM_API_KEY=your_api_key
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
npm start
```

## Deployment

Deploy to app.minilend.xyz subdomain or as standalone application.

## API Endpoints

- `POST /api/exchange-rate` - Get exchange rates
- `POST /api/validate` - Validate mobile number/account
- `POST /api/pay` - Process payment
- `POST /api/callback` - Payment callback handler
