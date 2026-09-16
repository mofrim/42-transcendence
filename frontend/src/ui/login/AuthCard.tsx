import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import type { GetProp, MessageArgsProps } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuthContext';
import type { ValidationError } from 'express-validator';
import axios from 'axios';
import type { ApiStatusResponse } from 'ftr-common/sharedTypes';

// -------------------------=[ style the messages ]=------------------------- //

const errorStyles: GetProp<MessageArgsProps, 'styles', 'Return'> = {
    root: {
        backgroundColor: 'rgba(250, 250, 250, 0.6)',
        border: '2px solid #bb3333',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
    },
    icon: {
        color: '#952222',
    },
    title: {
        color: '#952222',
        fontWeight: 600,
    },
};

const successStyles: GetProp<MessageArgsProps, 'styles', 'Return'> = {
    root: {
        backgroundColor: 'rgba(250, 250, 250, 0.6)',
        border: '2px solid #95de64',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
    },
    icon: {
        color: '#237804',
    },
    title: {
        color: '#237804',
        fontWeight: 600,
    },
};

const showErrMsg = (content: string) => {
    message.error({
        content,
        styles: errorStyles,
    });
};

const showSuccessMsg = (content: string) => {
    message.success({
        content,
        styles: successStyles,
    });
};

// ---------------------------=[ the login form ]=--------------------------- //

interface LoginFormProps {
    onSwitchToRegister: () => void;
}
const LoginForm: React.FC<LoginFormProps> = ({
    onSwitchToRegister,
}: LoginFormProps) => {
    // TODO this could be the state var for displaying a spinner or so..
    // not really used so far but maybe later. if not -> remove
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();

    const onFinish = async (values: { nickname: string; password: string }) => {
        setLoading(true);
        try {
            const success = await login(values.nickname, values.password);
            if (success) {
                showSuccessMsg('Login successful!');
            } else {
                showErrMsg('Invalid credentials!');
            }
        } catch (err) {
            void err;
            showErrMsg('Login malfunction! Plz try again');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <Form
                name='login'
                onFinish={onFinish}
                autoComplete='off'
                layout='vertical'
            >
                <Form.Item
                    name='nickname'
                    rules={[{ required: true, message: 'Nickname required' }]}
                >
                    <Input
                        prefix={<UserOutlined />}
                        placeholder='nickname'
                        size='large'
                    />
                </Form.Item>

                <Form.Item
                    name='password'
                    rules={[{ required: true, message: 'PW required' }]}
                >
                    <Input.Password
                        prefix={<LockOutlined />}
                        placeholder='password'
                        size='large'
                    />
                </Form.Item>

                <Form.Item>
                    <Button
                        type='primary'
                        htmlType='submit'
                        loading={loading}
                        size='large'
                        block
                        className='auth-submit-button'
                    >
                        Login
                    </Button>
                </Form.Item>
            </Form>
            <Button
                variant='outlined'
                color='primary'
                htmlType='submit'
                loading={loading}
                size='large'
                block
                onClick={onSwitchToRegister}
            >
                Register
            </Button>
        </Card>
    );
};

// -------------------------=[ the register form ]=------------------------- //

interface RegisterFormProps {
    onSwitchToLogin: () => void;
}

function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
    const onFinish = async (values: {
        nickname: string;
        email: string;
        password: string;
    }) => {
        try {
            await axios.post<ApiStatusResponse>('/api/user/register', values);
        } catch (err) {
            if (
                axios.isAxiosError<ValidationError[]>(err) &&
                err.response?.status === 400
            ) {
                const errors = err.response.data;
                if (errors.some((error) => error.msg === 'pw invalid length'))
                    showErrMsg('Registration failed: PW invalid length');

                if (errors.some((error) => error.msg === 'invalid email'))
                    showErrMsg('Registration failed: Invalid email');
                return;
            }
            if (
                axios.isAxiosError<ApiStatusResponse>(err) &&
                err.response?.status === 403
            ) {
                showErrMsg(`Registration failed: Nickname exists`);
                return;
            }
            showErrMsg(`Registration failed`);
            console.error('Registration failed:', err);
            return;
        }
        showSuccessMsg(`Registration successful! You may login now.`);
        onSwitchToLogin();
    };

    return (
        <Card>
            <Form
                name='register'
                onFinish={onFinish}
                autoComplete='off'
                layout='vertical'
            >
                <Form.Item
                    name='nickname'
                    rules={[{ required: true, message: 'nickname required' }]}
                >
                    <Input
                        prefix={<UserOutlined />}
                        placeholder='nickname'
                        size='large'
                    />
                </Form.Item>
                <Form.Item
                    name='email'
                    rules={[{ required: true, message: 'email required' }]}
                >
                    <Input
                        prefix={<MailOutlined />}
                        type='email'
                        placeholder='email'
                        size='large'
                    />
                </Form.Item>

                <Form.Item
                    name='password'
                    rules={[{ required: true, message: 'pw required' }]}
                >
                    <Input.Password
                        prefix={<LockOutlined />}
                        placeholder='password'
                        size='large'
                    />
                </Form.Item>

                <Form.Item>
                    <Button
                        type='primary'
                        htmlType='submit'
                        size='large'
                        block
                        className='auth-submit-button'
                    >
                        Submit
                    </Button>
                </Form.Item>
            </Form>
            <Button
                variant='outlined'
                color='primary'
                htmlType='submit'
                size='large'
                block
                onClick={onSwitchToLogin}
            >
                Back to Login
            </Button>
        </Card>
    );
}

// --------------------=[ the final AuthCard component ]=-------------------- //

type AuthMode = 'login' | 'register';

export const AuthCard: React.FC = () => {
    const [mode, setMode] = useState<AuthMode>('login');

    return mode === 'login' ? (
        <LoginForm onSwitchToRegister={() => setMode('register')} />
    ) : (
        <RegisterForm onSwitchToLogin={() => setMode('login')} />
    );
};
