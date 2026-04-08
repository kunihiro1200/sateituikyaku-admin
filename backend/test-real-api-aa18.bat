@echo off
echo Testing real API endpoint for seller AA18...
echo.

REM Get seller ID first
curl -s "http://localhost:3000/api/sellers?seller_number=AA18" > temp_seller_search.json

echo Seller search response:
type temp_seller_search.json
echo.
echo.

REM Extract seller ID (manual for now)
echo Please check the seller ID from the response above and test:
echo curl "http://localhost:3000/api/sellers/[SELLER_ID]"
echo.

del temp_seller_search.json
