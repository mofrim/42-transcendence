import { useAuth } from '../../hooks/useAuthContext';
import { Card } from 'antd';

// TODO add proper login / auth logic here
export const UserInfo: React.FC = () => {
    const { user } = useAuth();

    return (
        <Card
            title='User Info'
            styles={{
                root: {
                    boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                    borderRadius: '21px',
                    marginBottom: '15px',
                },
                body: {
                    paddingTop: '5px',
                },
            }}
        >
            <table>
                <tbody>
                    <tr>
                        <td style={{ textAlign: 'left' }}>
                            <strong>Nickname:</strong>
                        </td>
                        <td style={{ textAlign: 'left', paddingLeft: '10px' }}>
                            {user!.nickname}
                        </td>
                    </tr>
                    <tr>
                        <td style={{ textAlign: 'left' }}>
                            <strong>eMail:</strong>
                        </td>
                        <td style={{ textAlign: 'left', paddingLeft: '10px' }}>
                            {user!.email}
                        </td>
                    </tr>
                </tbody>
            </table>
        </Card>
    );
};
