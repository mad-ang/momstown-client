// Welcome to our source code!
// Project: 동물의왕국
// Contributed by: 윤중선 <https://github.com/Joong-Sunny> (FE,TL)
//                 이송희 <https://github.com/soneelee> (FE)
//                 우수연 <https://github.com/yeonwooz> (BE)
//                 김희산 <https://github.com/heesankim> (BE)
//                 김기운 <https://github.com/KiwoonKim> (BE)
// Thanks to SWJungle & KAIST where we made this project.

import React from 'react';
import styled from 'styled-components';
import { HashRouter } from 'react-router-dom';
import { useAppSelector } from './hooks';
import EntryDialog from './components/EntryDialog';
import CharacterSelectionDialog from './components/CharacterSelectionDialog';
import VideoConnectionDialog from './components/VideoConnectionDialog';
import TableDialog from './components/TableDialog';
import WelcomeToast from './components/ToastNotification';
import SignUpDialog from './components/SignUpDialog';
import SignInDialog from './components/SignInDialog';
import axios from 'axios';
import NavigationContainer from './components/NavigationUltimate/NavigationContainer';
import { ENTERING_PROCESS } from './stores/UserStore';

axios.defaults.baseURL =
  process.env.NODE_ENV === 'production' || import.meta.env.VITE_SERVER === 'PRO'
    ? `https://${import.meta.env.VITE_SERVER_URL}`
    : `http://${window.location.hostname}:8080`;

console.log('axios.defaults.baseURL ', axios.defaults.baseURL )

const Backdrop = styled.div`
  position: absolute;
  z-index: 10;
  height: 90%;
  width: 100%;
`;

function App() {
  console.log(88888, import.meta.env.VITE_ENDPOINT);
  const tableDialogOpen = useAppSelector((state) => state.table.tableDialogOpen);
  const videoConnected = useAppSelector((state) => state.user.videoConnected);
  const enteringProcess = useAppSelector((state) => state.user.enteringProcess);
  const characterSelected = useAppSelector((state) => state.user.characterSelected);

  let ui: JSX.Element;
  if (characterSelected) {
    if (tableDialogOpen) {
      ui = <TableDialog />;
    } else {
      ui = (
        /* Render Chat or VideoConnectionDialog if no dialogs are opened. */
        <>
          <NavigationContainer />
          {/* Render VideoConnectionDialog if user is not connected to a webcam. */}
          {!videoConnected && <VideoConnectionDialog />}
          <WelcomeToast />
        </>
      );
    }
  } else if (enteringProcess === ENTERING_PROCESS.ENTRY) {
    ui = <EntryDialog />;
  } else if (enteringProcess === ENTERING_PROCESS.SIGNUP) {
    ui = <SignUpDialog />;
  } else if (enteringProcess === ENTERING_PROCESS.LOGIN) {
    ui = <SignInDialog />;
  } else {
    ui = <CharacterSelectionDialog />;
  }

  return (
    <Backdrop className="Backdrop">
      {ui}
      {!tableDialogOpen}
    </Backdrop>
  );
}
export default App;
