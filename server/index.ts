import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from 'fs/promises';
import path from 'path';
import { handleDemo } from "./routes/demo";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get("/health", (_req, res) => res.status(200).send("OK"));

  // API to update mock.ts directly (Development Only)
  app.post("/api/update-mock", async (req, res) => {
    try {
      const { collection, data } = req.body;
      if (!collection || !data) {
        return res.status(400).json({ success: false, error: "Missing collection or data" });
      }

      // Safe list of allowed collections to modify
      const ALLOWED_COLLECTIONS = [
        "clients", "utilisateurs", "userAuth", "chambres", "tables", 
        "menu", "reservations", "commandes", "stockProduits", 
        "factures", "evenements", "chambresMaintenance"
      ];

      if (!ALLOWED_COLLECTIONS.includes(collection)) {
        return res.status(400).json({ success: false, error: "Invalid collection" });
      }

      const mockPath = path.resolve(__dirname, '../client/services/mock.ts');
      
      // Read current content
      let mockContent = await fs.readFile(mockPath, 'utf8');

      // Create replacement regex
      // Matches: export const collectionName: Type[] = [...]; 
      // OR export const collectionName: Record<...> = {...};
      // We assume standard formatting from the file
      const regex = new RegExp(`export const ${collection}: [^=]+ = [\\s\\S]*?;`, 'm');
      
      // Construct new declaration
      // We need to find the type definition to preserve it. 
      const match = mockContent.match(regex);
      if (!match) {
        return res.status(404).json({ success: false, error: "Collection not found in mock.ts" });
      }

      const currentDecl = match[0];
      const typePart = currentDecl.split('=')[0].split(':')[1].trim(); // e.g. "Client[]" or "Record<string, string>"

      const newDataString = JSON.stringify(data, null, 2);
      const newDecl = `export const ${collection}: ${typePart} = ${newDataString};`;

      // Replace
      mockContent = mockContent.replace(regex, newDecl);

      // Write back
      await fs.writeFile(mockPath, mockContent, 'utf8');
      
      console.log(`Updated ${collection} in mock.ts`);
      res.status(200).json({ success: true });
    } catch (e) {
      console.error("Error updating mock.ts", e);
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  return app;
}
