import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuthContext';

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

    const { login, logout } = useAuth();

    // FIXME perform a login on initial mount.. is this the best solution?
    // QUESTION what is the real idiomatic way of doing this
    useEffect(() => {
        logout();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onFinish = async (values: { nickname: string; password: string }) => {
        setLoading(true);
        try {
            const success = await login(values.nickname, values.password);
            if (success) {
                message.success('login successful!');
            } else {
                message.error('invalid credentials!');
            }
        } catch (err) {
            void err;
            message.error('login malfunctioned. plz try again');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card
            style={{
                width: '100%',
                maxWidth: 400,
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                borderRadius: '12px',
            }}
        >
            <Form
                name='login'
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
                        loading={loading}
                        size='large'
                        block
                        style={{
                            background:
                                'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                            border: 'none',
                        }}
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
        firstName: string;
        lastName: string;
        nickname: string;
        email: string;
        password: string;
    }) => {
        // TODO add user-creation logic here! needs the working user-sercice in
        // backend
        message.info(`(TODO) user registered: ${JSON.stringify(values)}`);
    };

    return (
        <Card
            style={{
                width: '100%',
                maxWidth: 400,
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                borderRadius: '12px',
            }}
        >
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
                    name='firstName'
                    rules={[{ required: true, message: 'firstName required' }]}
                >
                    <Input placeholder='firstName' size='large' />
                </Form.Item>

                <Form.Item
                    name='lastName'
                    rules={[{ required: true, message: 'lastName required' }]}
                >
                    <Input placeholder='lastName' size='large' />
                </Form.Item>

                <Form.Item
                    name='email'
                    rules={[{ required: true, message: 'email required' }]}
                >
                    <Input placeholder='email' size='large' />
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
                        style={{
                            background:
                                'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                            border: 'none',
                        }}
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
