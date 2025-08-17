import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// ✅ Allow requests from your frontend (local HTML file or dev server)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");  // Restrict this in production
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// 🔑 Token cache
let cachedToken = null;
let tokenExpiry = null;

// 🔑 Function to get Shiprocket token
async function getShiprocketToken() {
  if (cachedToken && tokenExpiry > Date.now()) {
    return cachedToken;
  }

  const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
  });

  cachedToken = response.data.token;
  tokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hr cache
  return cachedToken;
}

// 🚀 The API route for checking delivery
app.post('/check-delivery', async (req, res) => {
  const { pincode } = req.body;
  const pickupPin = process.env.SHIPROCKET_PICKUP_PIN;

  if (!/^\d{6}$/.test(pincode)) {
    return res.status(400).json({ error: "Invalid pincode format" });
  }

  try {
    const token = await getShiprocketToken();

    const result = await axios.get(
      `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=${pickupPin}&delivery_postcode=${pincode}&cod=1&weight=0.5`,
      {
        headers: { Authorization: `Bearer ${"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjcwNTM5NDIsInNvdXJjZSI6InNyLWF1dGgtaW50IiwiZXhwIjoxNzUyMzEzNTkxLCJqdGkiOiJxQjE3aEkzOXVOQlI1cnNrIiwiaWF0IjoxNzUxNDQ5NTkxLCJpc3MiOiJodHRwczovL3NyLWF1dGguc2hpcHJvY2tldC5pbi9hdXRob3JpemUvdXNlciIsIm5iZiI6MTc1MTQ0OTU5MSwiY2lkIjo2ODI1NDE5LCJ0YyI6MzYwLCJ2ZXJib3NlIjpmYWxzZSwidmVuZG9yX2lkIjowLCJ2ZW5kb3JfY29kZSI6IiJ9.qh63zGjdzByMEUXbsln1ZwktYzjpRodffmXMdAAa1bo"}` }
      }
    );

    const data = result.data;

        console.log("Shiprocket API response:", data);


      // ✅ Extract ETD from first courier
    const fastestCourier = data.data?.available_courier_companies?.[0];
    const estimatedDelivery = fastestCourier?.etd || "Unavailable";

    console.log("Fastest courier ETD:", estimatedDelivery);

    res.json({
      deliveryAvailable: data.status === 200 && fastestCourier ? true : false,
      estimatedDelivery,
      courierCompanies: data.data?.available_courier_companies || []
    });

  } catch (err) {
    console.error("Shiprocket error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to check delivery" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Shiprocket backend running at http://localhost:${PORT}`);
});
