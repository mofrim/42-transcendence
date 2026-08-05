import { useAuth } from '../../hooks/useAuthContext';
import { Card } from 'antd';

// TODO add proper login / auth logic here
export const UserInfo: React.FC = () => {
    const { user } = useAuth();

    return (
        <Card
            title='User Info'
            style={{
                width: '100%',
                maxWidth: 400,
                boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                borderRadius: '12px',
                marginBottom: '10px',
            }}
        >
            <p>
                <strong>Nickname:</strong> {user!.nickname}
            </p>
            <p>
                <strong>FirstName:</strong> {user!.firstName}
            </p>
            <p>
                <strong>LastName:</strong> {user!.lastName}
            </p>
            <p>
                <strong>eMail:</strong> {user!.email}
            </p>
        </Card>
    );
};
