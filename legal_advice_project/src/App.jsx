import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import Title from './Title'
//import './App.css'
//component名称需要大写
import RightBlock from './block'
import Banner from './banner';


function App() {
  const [drawerVisible, setDrawerVisible] = useState(false);

  return (
    <>
      <Banner/>
      <RightBlock visible={drawerVisible} setVisible={setDrawerVisible} />

      <div>
        <Title shrink={drawerVisible} />
      </div>  

    </>
    
  )
}

export default App
