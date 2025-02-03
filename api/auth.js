import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { email, password } = req.body;

  if (email === "admin@example.com" && password === "password123") {
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" });
    return res.status(200).json({ success: true, token });
  }

  res.status(401).json({ success: false, error: "Invalid credentials" });
}
