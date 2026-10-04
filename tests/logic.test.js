'use strict';
const assert=require('node:assert/strict');
const L=require('../logic.js');
const raw={generated_at:'2026-01-01T00:00:00Z',movements:[
  {id:'a',fecha:'05/01/2025',importe:'100,00',tipo:'Gasto',comercio:'Mercado ficticio',categoria:'Alimentación',medio_pago:'Tarjeta',cuenta:'Demo'},
  {id:'b',date:'2025-01-10',amount:30,type:'Devolución',merchant:'Mercado ficticio',category:'Alimentación'},
  {id:'c',date:'2025-01-28',amount:1000,type:'Ingreso',merchant:'Empresa inventada',category:'Nómina'},
  {id:'d',date:'2025-01-29',amount:250,type:'Transferencia',merchant:'Cuenta propia',category:'Transferencia interna'},
  {id:'e',date:'2025-02-01',amount:40,type:'Gasto',merchant:'Tienda de prueba',category:'Hogar',status:'Excluido del gasto'},
  {id:'f',date:'2025-02-02',amount:60,type:'Gasto',merchant:'Tienda de prueba',category:'Hogar'}
]};
const data=L.normalizeDataset(raw),rows=data.movements;
assert.equal(rows.length,6,'normaliza todos los movimientos');
assert.equal(rows[0].date,'2025-01-05','normaliza fecha española');
assert.equal(L.spendTotal(rows),130,'gasto neto incluye devolución y excluye transferencia/excluido');
assert.equal(L.incomeTotal(rows),1000,'solo suma ingresos reales');
assert.equal(L.balanceTotal(rows),870,'calcula balance');
assert.equal(rows.find(row=>row.id==='d').net_spend,0,'transferencia interna no cuenta');
assert.equal(rows.find(row=>row.id==='e').net_spend,0,'excluido no cuenta');
assert.equal(rows.find(row=>row.id==='b').net_spend,-30,'devolución reduce el gasto');
assert.equal(L.filterRows(rows,{year:'2025',month:'2025-02'}).length,2,'combina filtros');
assert.equal(L.filterRows(rows,{category:'Hogar',merchant:'Tienda de prueba',payment:'Sin dato',account:'Sin dato',type:'Gasto'}).length,2,'aplica todos los campos');
assert.equal(L.filterRows(rows,{from:'2025-01-01',to:'2025-01-31'}).length,4,'filtra fechas');
assert.equal(L.filterRows(rows,{search:'mercado ficticio'}).length,2,'búsqueda textual');
const monthly=L.monthlyBalance(rows);assert.deepEqual(monthly.map(item=>[item.period,item.income,item.spend,item.balance]),[['2025-01',1000,70,930],['2025-02',0,60,-60]],'balance mensual');
const comparison=L.comparePeriods(rows,'2025-02-01','2025-02-28','2025-01-01','2025-01-31');assert.equal(comparison.diff,-10);assert.equal(Math.round(comparison.pct*10)/10,-14.3);assert.equal(comparison.balanceA,-60);assert.equal(comparison.balanceB,930);
const zero=L.comparePeriods(rows,'2025-01-01','2025-01-31','2024-01-01','2024-01-31');assert.equal(zero.pct,null,'referencia cero no produce infinito');
const categories=L.categoryComparison(comparison.A,comparison.B),home=categories.find(item=>item.name==='Hogar');assert.equal(home.a,60);assert.equal(home.b,0);assert.equal(home.pct,null,'categoría con referencia cero no produce infinito');
assert.deepEqual(L.monthBounds('2024-02'),['2024-02-01','2024-02-29'],'respeta año bisiesto');
assert.throws(()=>L.normalizeDataset({movements:[{date:'fecha inválida'}]}),/fecha no válida/,'rechaza fechas inválidas');
console.log('OK: 18 comprobaciones de lógica financiera y filtros');
