import { sendValidationError } from "../errors.js";
import { validateCustomerSubscription, validateInventoryMovement, validateProduct } from "../validators.js";

export function registerProductsRoutes(app, { store, requireAuth, requireRole }) {
  app.get("/api/products", requireAuth, requireRole(["owner", "manager"]), async (_req, res, next) => {
    try {
      const [products, productSubscriptions, inventoryMovements] = await Promise.all([
        store.listProducts(),
        store.listCustomerSubscriptions(),
        store.listInventoryMovements()
      ]);
      res.json({ products, productSubscriptions, inventoryMovements });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/products", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = validateProduct(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.createProduct(parsed.value, req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "create", entityType: "product", entityId: id, summary: parsed.value.name });
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/api/products/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = validateProduct(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.updateProduct(Number(req.params.id), parsed.value);
      await store.createAuditLog({ actorId: req.user.id, action: "update", entityType: "product", entityId: id, summary: parsed.value.name });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/products/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const id = await store.deleteRecord("products", Number(req.params.id));
      await store.createAuditLog({ actorId: req.user.id, action: "delete", entityType: "product", entityId: id, summary: "Product deleted" });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/product-subscriptions", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = validateCustomerSubscription(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.createCustomerSubscription(parsed.value, req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "create", entityType: "customer_subscription", entityId: id, summary: `Product ${parsed.value.productId}` });
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/product-subscriptions/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const id = await store.deleteRecord("customer_subscriptions", Number(req.params.id));
      await store.createAuditLog({ actorId: req.user.id, action: "delete", entityType: "customer_subscription", entityId: id, summary: "Customer subscription deleted" });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/inventory-movements", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const parsed = validateInventoryMovement(req.body);
      if (parsed.error) return sendValidationError(res, parsed.error);
      const id = await store.createInventoryMovement(parsed.value, req.user.id);
      await store.createAuditLog({ actorId: req.user.id, action: "create", entityType: "inventory_movement", entityId: id, summary: `${parsed.value.type} ${parsed.value.quantity}` });
      return res.status(201).json({ id });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/inventory-movements/:id", requireAuth, requireRole(["owner", "manager"]), async (req, res, next) => {
    try {
      const id = await store.deleteInventoryMovement(Number(req.params.id));
      await store.createAuditLog({ actorId: req.user.id, action: "delete", entityType: "inventory_movement", entityId: id, summary: "Inventory movement deleted" });
      return res.json({ id });
    } catch (error) {
      return next(error);
    }
  });
}
