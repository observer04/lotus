const ITEMS={
  espresso:{name:"Espresso",cents:250,options:true},
  cappuccino:{name:"Cappuccino",cents:400,options:true},
  latte:{name:"Latte",cents:450,options:true},
  filter:{name:"Filter Coffee",cents:300,options:true},
  cold:{name:"Cold Brew",cents:425,options:true},
  croissant:{name:"Butter Croissant",cents:350,options:false}
};
const SIZE={Small:0,Medium:50,Large:100};
const KEY="coffee-cart-v1";
let cart=[];
try{cart=JSON.parse(localStorage.getItem(KEY)||"[]");if(!Array.isArray(cart))cart=[];}catch{cart=[];}
const money=c=>`$${(c/100).toFixed(2)}`;
function save(){localStorage.setItem(KEY,JSON.stringify(cart));}
function keyOf(id,size,milk){return `${id}|${size}|${milk}`;}
function add(id){const item=ITEMS[id],size=item.options?document.querySelector(`[data-testid="size-${id}"]`).value:"Small",milk=item.options?document.querySelector(`[data-testid="milk-${id}"]`).value:"None",key=keyOf(id,size,milk);const existing=cart.find(x=>x.key===key);if(existing)existing.qty++;else cart.push({key,id,size,milk,qty:1});save();render();}
function decrement(key){const i=cart.findIndex(x=>x.key===key);if(i<0)return;if(cart[i].qty<=1)cart.splice(i,1);else cart[i].qty--;save();render();}
function totals(){const subtotal=cart.reduce((sum,l)=>sum+(ITEMS[l.id].cents+(SIZE[l.size]||0))*l.qty,0);const tax=Math.round(subtotal*0.08);return{subtotal,tax,total:subtotal+tax};}
function renderMenu(){const root=document.querySelector("#menu");root.innerHTML="";for(const [id,item] of Object.entries(ITEMS)){const row=document.createElement("div");row.textContent=`${item.name} ${money(item.cents)} `;if(item.options){row.insertAdjacentHTML("beforeend",`<select data-testid="size-${id}"><option>Small</option><option>Medium</option><option>Large</option></select><select data-testid="milk-${id}"><option>Whole</option><option>Oat</option><option>None</option></select>`);}row.insertAdjacentHTML("beforeend",`<button data-testid="add-${id}">Add</button>`);row.querySelector("button").onclick=()=>add(id);root.append(row);}}
function render(){const root=document.querySelector("#cart");root.innerHTML="";if(!cart.length)root.textContent="Your cart is empty";for(const line of cart){const item=ITEMS[line.id],unit=item.cents+(SIZE[line.size]||0),el=document.createElement("div");el.dataset.testid="cart-line";el.innerHTML=`<span>${item.name}</span> <span>${line.size}</span> <span>${line.milk}</span> <span data-testid="line-qty">${line.qty}</span> <span data-testid="line-total">${money(unit*line.qty)}</span> <button data-testid="decrement">-</button>`;el.querySelector("button").onclick=()=>decrement(line.key);root.append(el);}const t=totals();document.querySelector('[data-testid="subtotal-value"]').textContent=money(t.subtotal);document.querySelector('[data-testid="tax-value"]').textContent=money(t.tax);document.querySelector('[data-testid="total-value"]').textContent=money(t.total);validate();}
function validate(){const name=document.querySelector('[data-testid="checkout-name"]').value.trim(),phone=document.querySelector('[data-testid="checkout-phone"]').value;document.querySelector('[data-testid="checkout-submit"]').disabled=!(cart.length&&name&&/^\d{10}$/.test(phone));}
for(const id of ["checkout-name","checkout-phone"])document.querySelector(`[data-testid="${id}"]`).addEventListener("input",validate);
document.querySelector('[data-testid="checkout-submit"]').onclick=()=>{if(document.querySelector('[data-testid="checkout-submit"]').disabled)return;const t=totals(),num=`ORD-${String(Math.floor(Math.random()*1000000)).padStart(6,"0")}`;const c=document.querySelector("#confirmation");c.hidden=false;c.innerHTML=`<h2>Order confirmed</h2><div data-testid="order-number">${num}</div><div data-testid="order-items">${cart.map(l=>`${ITEMS[l.id].name} x${l.qty}`).join(", ")}</div><div data-testid="order-total">${money(t.total)}</div>`;};
renderMenu();render();
