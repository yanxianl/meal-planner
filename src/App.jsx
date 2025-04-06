import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, isBefore, setHours, setMinutes } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from './supabaseClient';

const meals = ['早', '中', '晚'];
const mealDeadlines = [6, 9, 14];

const MealPlanner = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [data, setData] = useState([]);
  const [names, setNames] = useState([]);
  const [previousNames, setPreviousNames] = useState([]);
  const [userIdentity, setUserIdentity] = useState('');

  const startDay = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const currentStart = format(startDay, 'yyyy-MM-dd');
  const currentEnd = format(addDays(startDay, 6), 'yyyy-MM-dd');

  useEffect(() => {
    getCurrentUser();
    fetchData();
  }, [currentWeek]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserIdentity(user.email);
  };

  const fetchData = async () => {
    const { data: rows } = await supabase
      .from('meal_plan')
      .select('*')
      .gte('meal_date', currentStart)
      .lte('meal_date', currentEnd);

    const grouped = {};
    rows.forEach(row => {
      const key = row.user_name;
      if (!grouped[key]) grouped[key] = { name: row.user_name, count: row.meal_count || 1, plans: {}, email: row.owner_email };
      grouped[key].plans[`${row.meal_date}-${row.meal_type}`] = row.meal_count;
    });

    if (Object.keys(grouped).length === 0 && previousNames.length > 0) {
      const inherited = previousNames.map(u => ({ name: u.name, count: u.count, plans: {}, email: u.email }));
      setNames(inherited);
    } else {
      const inferred = Object.values(grouped);
      setNames(inferred);
      setPreviousNames(inferred);
    }
    setData(rows);
  };

  const persistUserPlans = async (user) => {
    const records = Object.entries(user.plans).map(([key, count]) => {
      const [meal_date, meal_type] = key.split('-');
      return {
        user_name: user.name,
        meal_date,
        meal_type,
        meal_count: user.count,
        owner_email: userIdentity,
      };
    });
    if (records.length > 0) {
      await Promise.all(records.map(r => supabase.from('meal_plan').upsert(r)));
    }
  };

  const changeWeek = async (direction) => {
    for (const user of names) {
      if (user.name && Object.keys(user.plans).length > 0) {
        await persistUserPlans(user);
      }
    }
    setCurrentWeek(addDays(currentWeek, direction * 7));
  };

  const handleCheck = async (user, day, meal) => {
    if (user.email !== userIdentity) return;
    const key = `${day}-${meal}`;
    const userIndex = names.findIndex(u => u.name === user.name);
    if (userIndex === -1) return;

    const updatedNames = [...names];
    const updatedUser = { ...updatedNames[userIndex] };
    const updatedPlans = { ...updatedUser.plans };

    if (updatedPlans[key]) {
      delete updatedPlans[key];
      await supabase.from('meal_plan').delete().match({ user_name: user.name, meal_date: day, meal_type: meal });
    } else {
      updatedPlans[key] = user.count;
      await supabase.from('meal_plan').upsert({ user_name: user.name, meal_date: day, meal_type: meal, meal_count: user.count, owner_email: userIdentity });
    }

    updatedUser.plans = updatedPlans;
    updatedNames[userIndex] = updatedUser;
    setNames(updatedNames);
  };

  const getMealCount = (day, meal) => {
    return names.reduce((sum, user) => {
      const key = `${format(day, 'yyyy-MM-dd')}-${meal}`;
      return sum + (user.plans?.[key] ? user.count : 0);
    }, 0);
  };

  const canCheck = (day, mealIdx) => {
    const deadline = setMinutes(setHours(day, mealDeadlines[mealIdx]), 0);
    return isBefore(new Date(), deadline);
  };

  const updateCount = async (idx) => {
    if (names[idx].email !== userIdentity) return;
    const input = prompt("请输入用餐人数:", names[idx].count);
    const newCount = parseInt(input, 10);
    if (!isNaN(newCount) && newCount > 0) {
      const user = names[idx];
      const updatedPlans = { ...user.plans };
      const updates = Object.keys(updatedPlans).map(key => {
        const [date, type] = key.split('-');
        updatedPlans[key] = newCount;
        return supabase.from('meal_plan').upsert({ user_name: user.name, meal_date: date, meal_type: type, meal_count: newCount, owner_email: userIdentity });
      });
      await Promise.all(updates);
      const updatedNames = [...names];
      updatedNames[idx] = { ...user, count: newCount, plans: updatedPlans };
      setNames(updatedNames);
    }
  };

  const updateName = async (idx, name) => {
    if (names[idx].email && names[idx].email !== userIdentity) return;
    const newNames = [...names];
    newNames[idx].name = name;
    newNames[idx].email = userIdentity;
    setNames(newNames);
    await supabase.from('meal_plan').upsert({ user_name: name, meal_date: currentStart, meal_type: '早', meal_count: 0, owner_email: userIdentity });
  };

  const deleteUser = async (user_name, email) => {
    if (email !== userIdentity) return;
    if (!window.confirm(`确定删除 ${user_name} 的所有用餐计划吗？`)) return;
    await supabase.from('meal_plan').delete().eq('user_name', user_name);
    setNames(prev => prev.filter(user => user.name !== user_name));
  };

  const addUser = () => {
    const name = prompt("请输入员工姓名:");
    if (name) {
      setNames([...names, { name, count: 1, plans: {}, email: userIdentity }]);
    }
  };

  return (
    <div className="p-6 font-sans max-w-full overflow-x-auto">
      <h2 className="text-3xl font-bold mb-6 text-center">升龙公司德合厂用餐计划表</h2>
      <div className="flex items-center justify-between mb-6">
        <ChevronLeft className="cursor-pointer" onClick={() => changeWeek(-1)} />
        <span className="text-xl font-semibold">
          {format(startDay, 'dd/MM/yyyy')} - {format(addDays(startDay, 6), 'dd/MM/yyyy')}
        </span>
        <ChevronRight className="cursor-pointer" onClick={() => changeWeek(1)} />
      </div>

      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2" rowSpan={2}>操作</th>
            <th className="border p-2" rowSpan={2}>姓名</th>
            <th className="border p-2" rowSpan={2}>用餐人数</th>
            {[...Array(7)].map((_, idx) => (
              <th key={idx} className="border p-2" colSpan={3}>
                {format(addDays(startDay, idx), 'dd/MM EEE', { locale: zhCN })}
              </th>
            ))}
          </tr>
          <tr>
            {[...Array(7)].map((_, idx) => (
              meals.map(meal => (
                <th key={`${idx}-${meal}`} className="border p-1 bg-gray-50">{meal}</th>
              ))
            ))}
          </tr>
        </thead>
        <tbody>
          {names.map((user, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="border p-2 text-center text-red-500 cursor-pointer"
                  onClick={() => deleteUser(user.name, user.email)}>
                {user.email === userIdentity && <Trash2 size={16} />}
              </td>
              <td className="border p-2">
                <input
                  className="w-full"
                  placeholder="输入姓名"
                  value={user.name}
                  onChange={(e) => updateName(idx, e.target.value)}
                  readOnly={user.email && user.email !== userIdentity}
                />
              </td>
              <td className="border p-2 cursor-pointer"
                  onClick={() => updateCount(idx)}>
                {user.count}
              </td>
              {[...Array(7)].map((_, dayIdx) => (
                meals.map((meal, mealIdx) => {
                  const day = format(addDays(startDay, dayIdx), 'yyyy-MM-dd');
                  const checked = !!user.plans?.[`${day}-${meal}`];
                  return (
                    <td key={`${dayIdx}-${meal}`} className="border p-1 text-center">
                      <input
                        type="checkbox"
                        disabled={!canCheck(addDays(startDay, dayIdx), mealIdx) || !user.name || user.email !== userIdentity}
                        checked={checked}
                        onChange={() => handleCheck(user, day, meal)}
                      />
                    </td>
                  );
                })
              ))}
            </tr>
          ))}
          <tr className="bg-gray-200 font-bold">
            <td className="border p-2 text-center" colSpan={3}>合计人数</td>
            {[...Array(7)].map((_, dayIdx) => (
              meals.map((meal, mealIdx) => (
                <td key={`total-${dayIdx}-${meal}`} className="border p-1 text-center">
                  {getMealCount(addDays(startDay, dayIdx), meal)}
                </td>
              ))
            ))}
          </tr>
        </tbody>
      </table>
      <button
        className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        onClick={addUser}
      >
        添加员工
      </button>
    </div>
  );
};

export default MealPlanner;
