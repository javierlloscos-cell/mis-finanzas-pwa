(function(root){
  'use strict';
  const text=value=>String(value??'').trim();
  const folded=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function toNum(value){
    if(typeof value==='number')return Number.isFinite(value)?value:0;
    let raw=text(value).replace(/\s/g,'').replace(/€/g,'');
    if(!raw)return 0;
    if(raw.includes(',')&&raw.includes('.'))raw=raw.lastIndexOf(',')>raw.lastIndexOf('.')?raw.replace(/\./g,'').replace(',','.'):raw.replace(/,/g,'');
    else if(raw.includes(','))raw=raw.replace(',','.');
    const number=Number(raw);return Number.isFinite(number)?number:0;
  }
  function normalizeDate(value){
    const raw=text(value);let match=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(match)return `${match[1]}-${match[2]}-${match[3]}`;
    match=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    return match?`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`:'';
  }
  function first(source,keys){for(const key of keys)if(source[key]!==undefined&&source[key]!==null&&source[key]!=='')return source[key];return ''}
  function isExcluded(row){return !!row&&(row.excluded===true||folded(row.status||row.estado).includes('excluid'))}
  function isInternalTransfer(row){
    if(!row)return false;if(row.internal_transfer===true||row.transferencia_interna===true)return true;
    const type=folded(row.type||row.tipo),description=folded(`${row.category||row.categoria||''} ${row.concept||row.concepto||''}`);
    return type==='transferencia'||type.includes('transferencia interna')||description.includes('transferencia interna');
  }
  function isRefund(row){const kind=folded(`${row?.type||row?.tipo||''} ${row?.status||row?.estado||''}`);return kind.includes('devolucion')||kind.includes('reembolso')||kind.includes('abono')}
  function isIncome(row){return !!row&&folded(row.type||row.tipo)==='ingreso'&&!isExcluded(row)&&!isInternalTransfer(row)&&!isRefund(row)}
  function normalizeMovement(raw,index){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error(`Movimiento ${index+1} no válido`);
    const date=normalizeDate(first(raw,['date','fecha','operation_date','fecha_operacion']));if(!date)throw new Error(`Movimiento ${index+1}: fecha no válida`);
    const amount=toNum(first(raw,['amount','importe','monto','value']));
    const normalized={...raw,id:text(first(raw,['id','movement_id','identificador']))||`local-${index+1}-${date}`,date,year:date.slice(0,4),month:date.slice(0,7),period:date.slice(0,7),merchant:text(first(raw,['merchant','comercio','counterparty','beneficiario']))||text(first(raw,['concept','concepto','description','descripcion']))||'Sin comercio',concept:text(first(raw,['concept','concepto','description','descripcion'])),category:text(first(raw,['category','categoria']))||'Sin categoría',payment:text(first(raw,['payment','medio_pago','payment_method','metodo_pago']))||'Sin dato',account:text(first(raw,['account','cuenta','card','tarjeta','account_card']))||'Sin dato',type:text(first(raw,['type','tipo','movement_type','tipo_movimiento']))||'Gasto',status:text(first(raw,['status','estado'])),amount};
    const suppliedNet=first(raw,['net_spend','gasto_neto']);
    if(isExcluded(normalized)||isInternalTransfer(normalized)||isIncome(normalized))normalized.net_spend=0;
    else if(suppliedNet!=='')normalized.net_spend=toNum(suppliedNet);
    else if(isRefund(normalized))normalized.net_spend=-Math.abs(amount);
    else normalized.net_spend=Math.abs(amount);
    normalized.excluded=isExcluded(normalized);normalized.internal_transfer=isInternalTransfer(normalized);normalized.refund=isRefund(normalized);return normalized;
  }
  function normalizeDataset(input){
    const source=Array.isArray(input)?{movements:input}:input;
    if(!source||!Array.isArray(source.movements))throw new Error('El JSON debe contener una lista "movements"');
    if(!source.movements.length)throw new Error('El archivo no contiene movimientos');
    const movements=source.movements.map(normalizeMovement).sort((a,b)=>a.date.localeCompare(b.date));
    return {schema_version:2,generated_at:text(source.generated_at||source.generado_el)||new Date().toISOString(),movement_count:movements.length,movements};
  }
  const spendTotal=rows=>(rows||[]).reduce((sum,row)=>sum+toNum(row.net_spend),0);
  const spendRows=rows=>(rows||[]).filter(row=>toNum(row.net_spend)!==0);
  const positiveSpendRows=rows=>(rows||[]).filter(row=>toNum(row.net_spend)>0);
  const incomeTotal=rows=>(rows||[]).reduce((sum,row)=>sum+(isIncome(row)?Math.abs(toNum(row.amount)):0),0);
  const balanceTotal=rows=>incomeTotal(rows)-spendTotal(rows);
  function filterRows(rows,filters,options={}){
    const f=filters||{};return(rows||[]).filter(row=>{
      if(f.year&&String(row.year)!==String(f.year))return false;if(f.month&&row.month!==f.month)return false;
      if(f.category&&row.category!==f.category)return false;if(f.merchant&&row.merchant!==f.merchant)return false;
      if(f.payment&&row.payment!==f.payment)return false;if(f.account&&row.account!==f.account)return false;if(f.type&&row.type!==f.type)return false;
      if(!options.ignoreDates&&((f.from&&row.date<f.from)||(f.to&&row.date>f.to)))return false;
      if(!options.ignoreSearch&&f.search&&!folded(`${row.merchant} ${row.concept} ${row.category} ${row.type} ${row.payment} ${row.account}`).includes(folded(f.search)))return false;
      return true;
    });
  }
  const between=(rows,from,to)=>!from||!to?[]:(rows||[]).filter(row=>row.date>=from&&row.date<=to);
  function nameSort(a,b){return String(a).localeCompare(String(b),'es',{sensitivity:'base'})}
  function groupSpend(rows,key){const grouped=new Map();for(const row of rows||[]){const name=text(row[key])||'Sin dato';grouped.set(name,(grouped.get(name)||0)+toNum(row.net_spend))}return[...grouped].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value||nameSort(a.name,b.name))}
  function monthlyBalance(rows){
    const grouped=new Map();for(const row of rows||[]){if(!row.period)continue;if(!grouped.has(row.period))grouped.set(row.period,{period:row.period,income:0,spend:0,balance:0,operations:[]});const item=grouped.get(row.period);item.operations.push(row);item.spend+=toNum(row.net_spend);if(isIncome(row))item.income+=Math.abs(toNum(row.amount))}
    return[...grouped.values()].sort((a,b)=>a.period.localeCompare(b.period)).map(item=>({...item,balance:item.income-item.spend}));
  }
  function averages(rows){const spend=spendTotal(rows),months=new Set((rows||[]).map(row=>row.period).filter(Boolean)).size,days=new Set((rows||[]).map(row=>row.date).filter(Boolean)).size,operations=spendRows(rows).length;return{monthly:months?spend/months:0,daily:days?spend/days:0,operation:operations?spend/operations:0,months,days,operations}}
  function comparePeriods(rows,aFrom,aTo,bFrom,bTo){const A=between(rows,aFrom,aTo),B=between(rows,bFrom,bTo),spendA=spendTotal(A),spendB=spendTotal(B),diff=spendA-spendB,incomeA=incomeTotal(A),incomeB=incomeTotal(B),balanceA=incomeA-spendA,balanceB=incomeB-spendB;return{A,B,spendA,spendB,diff,pct:spendB!==0?diff/spendB*100:null,incomeA,incomeB,balanceA,balanceB,balanceDiff:balanceA-balanceB}}
  function categoryComparison(A,B){const aa=Object.fromEntries(groupSpend(A,'category').map(x=>[x.name,x.value])),bb=Object.fromEntries(groupSpend(B,'category').map(x=>[x.name,x.value]));return[...new Set([...Object.keys(aa),...Object.keys(bb)])].map(name=>{const a=aa[name]||0,b=bb[name]||0,diff=a-b;return{name,a,b,diff,pct:b!==0?diff/b*100:null}}).filter(x=>x.a!==0||x.b!==0).sort((x,y)=>Math.abs(y.diff)-Math.abs(x.diff))}
  const isoDateUTC=date=>`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
  function monthBounds(period){const[y,m]=period.split('-').map(Number);return[isoDateUTC(new Date(Date.UTC(y,m-1,1))),isoDateUTC(new Date(Date.UTC(y,m,0)))]}
  function shiftMonths(period,delta){const[y,m]=period.split('-').map(Number),date=new Date(Date.UTC(y,m-1+delta,1));return`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`}
  function comparisonPreset(rows,preset){
    const dates=(rows||[]).map(row=>row.date).filter(Boolean).sort();if(!dates.length)return null;const maxDate=dates[dates.length-1],maxPeriod=maxDate.slice(0,7),[y,m,d]=maxDate.split('-').map(Number),lastComplete=d===new Date(Date.UTC(y,m,0)).getUTCDate()?maxPeriod:shiftMonths(maxPeriod,-1);
    if(preset==='month'){const A=monthBounds(lastComplete),B=monthBounds(shiftMonths(lastComplete,-1));return{aFrom:A[0],aTo:A[1],bFrom:B[0],bTo:B[1],label:'Último mes completo vs mes anterior'}}
    if(preset==='3m'||preset==='6m'){const count=preset==='3m'?3:6,aEnd=lastComplete,aStart=shiftMonths(aEnd,-(count-1)),bEnd=shiftMonths(aStart,-1),bStart=shiftMonths(bEnd,-(count-1));return{aFrom:monthBounds(aStart)[0],aTo:monthBounds(aEnd)[1],bFrom:monthBounds(bStart)[0],bTo:monthBounds(bEnd)[1],label:`Últimos ${count} meses completos vs ${count} anteriores`}}
    if(preset==='year'){const year=Number(lastComplete.slice(0,4));return{aFrom:`${year}-01-01`,aTo:`${year}-12-31`,bFrom:`${year-1}-01-01`,bTo:`${year-1}-12-31`,label:'Año más reciente vs año anterior'}}return null;
  }
  const api={toNum,normalizeDate,normalizeMovement,normalizeDataset,isExcluded,isInternalTransfer,isRefund,isIncome,spendTotal,spendRows,positiveSpendRows,incomeTotal,balanceTotal,filterRows,between,groupSpend,monthlyBalance,averages,comparePeriods,categoryComparison,monthBounds,shiftMonths,comparisonPreset};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FinanceLogic=api;
})(typeof globalThis!=='undefined'?globalThis:this);
