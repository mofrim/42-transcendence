import { useAuth } from '../../hooks/useAuthContext';
import { Card } from 'antd';

// TODO add proper login / auth logic here
export const UserInfo: React.FC = () => {
    const { user } = useAuth();

    return (
        <Card title='User Info' className='user-info-card'>
            <table>
                <tbody>
                    <tr>
                        <td>
                            <strong>Nickname:</strong>
                        </td>
                        <td>{user!.nickname}</td>
                    </tr>
                    <tr>
                        <td>
                            <strong>eMail:</strong>
                        </td>
                        <td>{user!.email}</td>
                    </tr>
                </tbody>
            </table>
        </Card>
    );
};
