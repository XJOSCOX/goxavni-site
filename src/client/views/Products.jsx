import React from "react";
import { Edit3, PackagePlus } from "lucide-react";
import { EditActions, EditInput, EditSelect, Input, Metric, Panel, Select, Table } from "../components.jsx";
import { api, messageForError, money } from "../api.js";

const productTypes = [["app", "App"], ["subscription", "Subscription"], ["resale", "Resale"], ["inventory", "Inventory"], ["service", "Service"]];
const platforms = [["", "None"], ["android", "Android"], ["ios", "iOS"], ["web", "Web"], ["physical", "Physical"], ["mixed", "Mixed"], ["service", "Service"]];
const billingUnits = [["month", "Month"], ["year", "Year"], ["week", "Week"], ["day", "Day"]];
const subscriptionStatuses = [["active", "Active"], ["paused", "Paused"], ["canceled", "Canceled"], ["expired", "Expired"]];
const movementTypes = [["purchase", "Purchase"], ["sale", "Sale"], ["return", "Return"], ["adjustment", "Adjustment"]];

function optionsWithBlank(label, rows, mapper) {
  return [["", label], ...rows.map(mapper)];
}

function frequencyText(row) {
  const label = row.billingEvery === 1 ? row.billingUnit : `${row.billingUnit}s`;
  return `Every ${row.billingEvery} ${label}`;
}

export function Products({ data, editing, isEditing, setEditValue, startEdit, cancelEdit, saveEdit, submit, refreshData, setMessage }) {
  const activeProducts = data.products.filter((product) => product.active);
  const lowStock = data.products.filter((product) => product.active && product.lowStock);
  const inventoryUnits = data.products.reduce((total, product) => total + Number(product.stockQuantity || 0), 0);
  const activeSubscriptions = data.productSubscriptions.filter((subscription) => subscription.status === "active");
  const customerOptions = optionsWithBlank("Choose customer", data.contacts.filter((contact) => contact.active && contact.type === "customer"), (contact) => [contact.id, contact.company ? `${contact.name} - ${contact.company}` : contact.name]);
  const productOptions = optionsWithBlank("Choose product", activeProducts, (product) => [product.id, product.sku ? `${product.sku} - ${product.name}` : product.name]);

  async function submitAndRefresh(endpoint, form, success) {
    try {
      await submit(endpoint, form, success);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createInventoryMovement(event) {
    event.preventDefault();
    setMessage("");
    try {
      await api("/api/inventory-movements", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries()))
      });
      event.currentTarget.reset();
      await refreshData();
      setMessage("Inventory updated.");
    } catch (error) {
      setMessage(messageForError(error));
    }
  }

  return (
    <section className="view">
      <div className="metric-grid compact-metrics">
        <Metric label="Active products" value={activeProducts.length} />
        <Metric label="Customer subscriptions" value={activeSubscriptions.length} />
        <Metric label="Inventory units" value={inventoryUnits} />
        <Metric label="Low stock" value={lowStock.length} />
      </div>

      <Panel title="New Product">
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submitAndRefresh("/api/products", event.currentTarget, "Product saved."); }}>
          <Input name="sku" label="SKU" />
          <Input name="name" label="Name" required />
          <Select name="type" label="Type" options={productTypes} required />
          <Select name="platform" label="Platform" options={platforms} />
          <Input name="price" label="Price" type="number" min="0.01" step="0.01" required />
          <Input name="cost" label="Cost" type="number" min="0" step="0.01" />
          <Input name="stockQuantity" label="Stock" type="number" min="0" step="1" defaultValue="0" required />
          <Input name="reorderLevel" label="Reorder level" type="number" min="0" step="1" defaultValue="0" required />
          <Input className="wide" name="description" label="Description" />
          <div className="form-actions"><button type="submit">Save product</button></div>
        </form>
      </Panel>

      <Panel title="Customer Subscription">
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submitAndRefresh("/api/product-subscriptions", event.currentTarget, "Customer subscription saved."); }}>
          <Select name="customerId" label="Customer" options={customerOptions} required />
          <Select name="productId" label="Product" options={productOptions} required />
          <Select name="status" label="Status" options={subscriptionStatuses} required />
          <Input name="startedOn" label="Started" type="date" required />
          <Input name="nextBillingOn" label="Next billing" type="date" />
          <Input name="billingEvery" label="Bill every" type="number" min="1" max="365" defaultValue="1" required />
          <Select name="billingUnit" label="Unit" options={billingUnits} required />
          <Input name="amount" label="Amount" type="number" min="0.01" step="0.01" required />
          <Input className="wide" name="notes" label="Notes" />
          <div className="form-actions"><button type="submit">Save subscription</button></div>
        </form>
      </Panel>

      <Panel title="Inventory Movement">
        <form className="form-grid compact" onSubmit={createInventoryMovement}>
          <Select name="productId" label="Product" options={productOptions} required />
          <Input name="movementOn" label="Date" type="date" required />
          <Select name="type" label="Type" options={movementTypes} required />
          <Input name="quantity" label="Quantity" type="number" step="1" required />
          <Input name="unitCost" label="Unit cost" type="number" min="0" step="0.01" />
          <Input className="wide" name="notes" label="Notes" />
          <div className="form-actions"><button type="submit"><PackagePlus size={15} /> Update stock</button></div>
        </form>
      </Panel>

      <Panel title="Products" action={<a className="ghost link-button" href="/api/reports/products.csv">Products CSV</a>}>
        <Table columns={["SKU", "Name", "Type", "Platform", "Price", "Cost", "Stock", "Status", "Actions"]} empty="No products yet." rows={data.products.map((product) => {
          const rowEditing = isEditing("product", product.id);
          return rowEditing ? (
            <tr key={product.id}>
              <td><EditInput value={editing.values.sku} onChange={(value) => setEditValue("sku", value)} /></td>
              <td><EditInput value={editing.values.name} onChange={(value) => setEditValue("name", value)} /></td>
              <td><EditSelect value={editing.values.type} options={productTypes} onChange={(value) => setEditValue("type", value)} /></td>
              <td><EditSelect value={editing.values.platform} options={platforms} onChange={(value) => setEditValue("platform", value)} /></td>
              <td className="amount"><EditInput type="number" min="0.01" step="0.01" value={editing.values.price} onChange={(value) => setEditValue("price", value)} /></td>
              <td className="amount"><EditInput type="number" min="0" step="0.01" value={editing.values.cost} onChange={(value) => setEditValue("cost", value)} /></td>
              <td>
                <div className="inline-stack compact-stack">
                  <EditInput type="number" min="0" step="1" value={editing.values.stockQuantity} onChange={(value) => setEditValue("stockQuantity", value)} />
                  <EditInput type="number" min="0" step="1" value={editing.values.reorderLevel} placeholder="Reorder" onChange={(value) => setEditValue("reorderLevel", value)} />
                </div>
              </td>
              <td><EditSelect value={editing.values.active} options={[["true", "Active"], ["false", "Inactive"]]} onChange={(value) => setEditValue("active", value)} /></td>
              <td>
                <div className="inline-stack">
                  <EditInput value={editing.values.description} placeholder="Description" onChange={(value) => setEditValue("description", value)} />
                  <EditActions onSave={() => saveEdit(`/api/products/${product.id}`, "Product updated.").catch((error) => setMessage(error.message))} onCancel={cancelEdit} />
                </div>
              </td>
            </tr>
          ) : (
            <tr key={product.id}>
              <td>{product.sku || ""}</td>
              <td>{product.name}</td>
              <td>{product.type}</td>
              <td>{product.platform || ""}</td>
              <td className="amount">{money.format(product.price || 0)}</td>
              <td className="amount">{money.format(product.cost || 0)}</td>
              <td className={product.lowStock ? "amount negative" : "amount"}>{product.stockQuantity}</td>
              <td>{product.active ? "Active" : "Inactive"}</td>
              <td><button className="icon-button ghost" type="button" title="Edit product" onClick={() => startEdit("product", product.id, { sku: product.sku || "", name: product.name, type: product.type, platform: product.platform || "", description: product.description || "", price: product.price, cost: product.cost, stockQuantity: product.stockQuantity, reorderLevel: product.reorderLevel, active: String(product.active) })}><Edit3 size={15} /></button></td>
            </tr>
          );
        })} />
      </Panel>

      <Panel title="Customer Subscriptions" action={<a className="ghost link-button" href="/api/reports/customer-subscriptions.csv">Customer Subscriptions CSV</a>}>
        <Table columns={["Customer", "Product", "Status", "Started", "Next Billing", "Frequency", "Amount", "Notes"]} empty="No customer subscriptions yet." rows={data.productSubscriptions.map((subscription) => (
          <tr key={subscription.id}>
            <td>{subscription.customerName}</td>
            <td>{subscription.productName}</td>
            <td>{subscription.status}</td>
            <td>{subscription.startedOn}</td>
            <td>{subscription.nextBillingOn || ""}</td>
            <td>{frequencyText(subscription)}</td>
            <td className="amount">{money.format(subscription.amount || 0)}</td>
            <td>{subscription.notes || ""}</td>
          </tr>
        ))} />
      </Panel>

      <Panel title="Inventory Movements" action={<a className="ghost link-button" href="/api/reports/inventory-movements.csv">Inventory CSV</a>}>
        <Table columns={["Date", "Product", "Type", "Quantity", "Unit Cost", "Notes"]} empty="No inventory movements yet." rows={data.inventoryMovements.map((movement) => (
          <tr key={movement.id}>
            <td>{movement.movementOn}</td>
            <td>{movement.productName}</td>
            <td>{movement.type}</td>
            <td className={movement.type === "sale" ? "amount negative" : "amount"}>{movement.type === "sale" ? `-${movement.quantity}` : movement.quantity}</td>
            <td className="amount">{money.format(movement.unitCost || 0)}</td>
            <td>{movement.notes || ""}</td>
          </tr>
        ))} />
      </Panel>
    </section>
  );
}
