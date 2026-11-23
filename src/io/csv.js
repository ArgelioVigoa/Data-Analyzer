/** CSV parser with quoted cells, escaped quotes and configurable delimiter. */
export function parseCSV(input,delimiter=","){
 if(typeof input!=="string")throw new TypeError("CSV input must be a string");
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<input.length;i++){const ch=input[i];
  if(quoted){if(ch==='"'&&input[i+1]==='"'){cell+='"';i++}else if(ch==='"')quoted=false;else cell+=ch}
  else if(ch==='"'&&cell.length===0)quoted=true;
  else if(ch===delimiter){row.push(cell);cell=""}
  else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&input[i+1]==="\n")i++;row.push(cell);cell="";if(row.some(v=>v.length))rows.push(row);row=[]}
  else cell+=ch;
 }
 if(quoted)throw new Error("CSV contains an unterminated quoted field");
 row.push(cell);if(row.some(v=>v.length))rows.push(row);return rows;
}
export function rowsToObjects(rows){if(!rows.length)return[];const headers=rows[0].map((v,i)=>v.trim()||`column_${i+1}`);return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])));}
