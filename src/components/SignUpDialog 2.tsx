import React, { useState } from "react";
import styled from "styled-components";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import axios from "axios";
import { useAppSelector, useAppDispatch } from "../hooks";
import { setSignUp, setSignIn, setSignedUp } from "../stores/UserStore";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

const Wrapper = styled.form`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #222639;
  border-radius: 16px;
  padding: 36px 60px;
  box-shadow: 0px 0px 5px #0000006f;
`;

const Title = styled.h3`
  margin: 5px;
  text-align: center;
  font-size: 24px;
  color: #eee;
`;

const Content = styled.div`
  display: flex;

  gap: 20px;
  margin: 20px 0;
  align-items: center;
  justify-content: center;


`;

export default function SignUpDialog() {
  const dispatch = useAppDispatch();

  const [showPassword, setShowPassword] = React.useState(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
  };

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [pwFieldEmpty, setPwFieldEmpty] = useState<boolean>(false);

  const [userIdFieldEmpty, setUserIdFieldEmpty] = useState<boolean>(false);
  const [userIdFieldWrong, setUserIdFieldWrong] = useState<boolean>(false);

  // const onUserIdHandler = (event) => {
  //   setUserId(event.currentTarget.value);
  // }

  // const onPasswordHandler = (event) => {
  //       setPassword(event.currentTarget.value);
  // }

    const goToEntry = (event) => {
      event.preventDefault();

      dispatch(setSignUp(false));
      dispatch(setSignedUp(false));
      dispatch(setSignIn(false));
  }

  const onSubmitHandler = (event) => {
    event.preventDefault();
    setUserIdFieldEmpty(false);
    setUserIdFieldWrong(false);
    setPwFieldEmpty(false);

    console.log(userId);
    console.log(userIdFieldEmpty);
    if (userId === "") {
      setUserIdFieldEmpty(true);
    }
    if (password === "") {
      setPwFieldEmpty(true);
    } else {
      let body = {
        userId: userId,
        password: password,
      };

      console.log({ userId });
      console.log({ password });

      axios
        .post("/auth/signup", body)
        .then(function (response) {
          // response
          if (response.data.status == 200) {
            dispatch(setSignUp(false));
            dispatch(setSignedUp(true));
            dispatch(setSignIn(true));
          } else {
            console.log("11111");
          }
        })
        .catch(function (error) {
          // 오류발생시 실행
          setUserIdFieldWrong(true);
          console.log("hi", error.message);
          if (error.message == "Request failed with status code 409") {
            console.log("22222");
          } else {
            console.log("444444");
          }
        })
        .then(function () {
          // 항상 실행
          console.log("333333");
        });
    }
  };

  return (
    <>
      <Wrapper>
        <Title>회원가입</Title>
        <TextField
          autoFocus
          fullWidth
          label="아이디"
          variant="outlined"
          color="secondary"
          margin="normal"
          error={userIdFieldEmpty || userIdFieldWrong}
          helperText={
            (userIdFieldEmpty && "이름이 필요해요") ||
            (userIdFieldWrong && "이미 존재하는 아이디입니다.")
          }
          onInput={(e) => {
            setUserId((e.target as HTMLInputElement).value);
          }}
        />
        <TextField
          autoFocus
          fullWidth
          label="비밀번호"
          variant="outlined"
          color="secondary"
          margin="normal"
          error={pwFieldEmpty}
          helperText={pwFieldEmpty && "비밀번호가 필요해요"}
          onInput={(e) => {
            setPassword((e.target as HTMLInputElement).value);
          }}
          type={showPassword ? "text" : "password"}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={handleClickShowPassword}
                  onMouseDown={handleMouseDownPassword}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
  <Content>
        <Button variant="contained" color="secondary" onClick={onSubmitHandler} sx={{mx: 2}}>
          회원가입 완료
        </Button>
        <Button variant="contained" color="secondary" onClick={goToEntry} sx={{mx: 2}}>
          뒤로 가기
        </Button>
  </Content>
      </Wrapper>
    </>
  );
}