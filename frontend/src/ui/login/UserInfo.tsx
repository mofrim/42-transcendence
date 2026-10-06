import { useAuth } from '../../hooks/useAuthContext';
import { Card } from 'antd';

export const UserInfo: React.FC = () => {
    const { user } = useAuth();

    if (user === null) {
        return null;
    }

    return (
        <Card title='User Info' className='user-info-card'>
            <table>
                <tbody>
                    <tr>
                        <td>
                            <strong>Nickname:</strong>
                        </td>
                        <td>{user.nickname}</td>
                    </tr>
                    <tr>
                        <td>
                            <strong>eMail:</strong>
                        </td>
                        <td>{user.email}</td>
                    </tr>
                </tbody>
            </table>
        </Card>
    );
};
