import {useState} from 'react';
import {definePlugin,useHostAction,useHostLocale} from '@enterprise/agent-ui-plugin-sdk';
function Counter({data}:{data:{value:number;title:string}}){const dispatch=useHostAction(),locale=useHostLocale();const [clicks,setClicks]=useState(0);return <section><h3>{data.title}</h3><p data-testid="counter-locale">{locale}</p><output>{data.value}</output><button onClick={()=>{setClicks(v=>v+1);dispatch('counter.increment',{value:data.value,clicks:clicks+1})}}>{locale==='zh-CN'?'增加':'Increment'}</button><span data-testid="local-clicks">{clicks}</span></section>}
export default definePlugin({id:'thirdparty.counter',version:'1.0.0',Component:Counter});
